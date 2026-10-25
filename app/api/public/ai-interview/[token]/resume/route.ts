import { NextRequest, NextResponse } from "next/server";
import {
  assertSessionPath, checkAiMedia, createAiMediaPath,
  downloadAiMedia, normalizeMime, storeAiMediaFallback,
} from "@/lib/ai-interview-media";
import {
  callOpenAIJson,
  clean,
  findJobByInterviewToken,
  jobInterviewConfig,
  prisma,
} from "@/lib/ai-interview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function extractResumeWithOpenAI(file: File) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const isImage = /^image\//i.test(file.type);
  let fileContent: any;

  if (isImage) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type || "image/jpeg"};base64,${bytes.toString("base64")}`;
    fileContent = { type: "input_image", image_url: dataUrl };
  } else {
    const fd = new FormData();
    fd.append("purpose", "user_data");
    fd.append("file", file, file.name);

    const upload = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });

    const uploadText = await upload.text();
    if (!upload.ok) throw new Error(uploadText);

    const uploaded = JSON.parse(uploadText);
    fileContent = { type: "input_file", file_id: uploaded.id };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Extraia dados profissionais do currículo sem inferir atributos sensíveis. Responda somente JSON válido.",
        },
        {
          role: "user",
          content: [
            fileContent,
            {
              type: "input_text",
              text: `Extraia apenas dados presentes no currículo.

Retorne:
{
  "name": "",
  "cpf": "",
  "phone": "",
  "email": "",
  "city": "",
  "state": "",
  "education": "",
  "course": "",
  "institution": "",
  "lastRole": "",
  "professionalSummary": "",
  "skills": [],
  "languages": [],
  "experiences": [
    {
      "company": "",
      "role": "",
      "start": "",
      "end": "",
      "description": ""
    }
  ],
  "resumeText": "resumo textual fiel das experiências, formação, resultados e competências"
}

Não invente nada e não faça avaliação psicológica.`,
            },
          ],
        },
      ],
      temperature: 0.1,
      max_output_tokens: 2200,
    }),
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(raw);

  const payload = JSON.parse(raw);
  const outputText =
    payload?.output_text ||
    payload?.output?.[0]?.content?.find((part: any) => typeof part?.text === "string")?.text ||
    "";

  let parsed: any = null;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    const match = String(outputText).match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }

  if (!parsed) throw new Error("Não foi possível interpretar o currículo.");
  return parsed;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const job = await findJobByInterviewToken(token);

    if (!job) {
      return NextResponse.json({ error: "Entrevista não encontrada." }, { status: 404 });
    }

    const isJson = req.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await req.json() : await req.formData();
    const sessionToken = clean(isJson ? body.sessionToken : body.get("sessionToken"));
    const uploadedPath = isJson ? clean(body.storagePath) : "";
    const originalFile = isJson ? null : body.get("file");

    if (!sessionToken || (isJson ? !uploadedPath : !(originalFile instanceof File))) {
      return NextResponse.json({ error: "Sessão e currículo são obrigatórios." }, { status: 400 });
    }

    const sessionRows = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "candidate_ai_interview_sessions"
      WHERE "session_token" = ${sessionToken}
        AND "company_id"::text = ${String(job.company_id)}::text
        AND "job_id"::text = ${String(job.id)}::text
      LIMIT 1
    `;

    if (!sessionRows.length) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 404 });
    }

    const session = sessionRows[0];
    if (session.status === "completed") {
      return NextResponse.json({ error: "A entrevista já foi concluída." }, { status: 409 });
    }

    let file: File;
    let storagePath: string;

    if (isJson) {
      storagePath = assertSessionPath(
        uploadedPath, String(job.company_id), String(session.id), "resume"
      );
      const media = await downloadAiMedia(storagePath);
      const declaredName = String(body.fileName || "curriculo.pdf").slice(0, 180);
      const mime = normalizeMime(media.mime, declaredName);
      checkAiMedia("resume", mime, media.bytes.byteLength);
      file = new File([media.bytes], declaredName, { type: mime });
    } else {
      file = originalFile as File;
      const mime = normalizeMime(file.type, file.name);
      checkAiMedia("resume", mime, file.size);
      storagePath = createAiMediaPath(
        String(job.company_id), String(session.id), "resume", mime
      );
      await storeAiMediaFallback(storagePath, file);
    }

    const resume = await extractResumeWithOpenAI(file);
    const cpf = clean(resume.cpf);
    const email = clean(resume.email || session.candidate_email).toLowerCase();
    const phone = clean(resume.phone || session.candidate_phone);
    const name = clean(resume.name || session.candidate_name);

    let candidate = null;

    if (cpf || email || phone) {
      candidate = await prisma.candidateProfile.findFirst({
        where: {
          company_id: job.company_id,
          OR: [
            ...(cpf ? [{ cpf }] : []),
            ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
            ...(phone ? [{ phone }, { mobile: phone }] : []),
          ],
        },
      });
    }

    const candidateData: any = {
      company_id: job.company_id,
      name: name || session.candidate_name || "Candidato",
      cpf: cpf || candidate?.cpf || null,
      phone: phone || candidate?.phone || null,
      mobile: phone || candidate?.mobile || null,
      email: email || candidate?.email || null,
      city: clean(resume.city) || candidate?.city || null,
      state: clean(resume.state) || candidate?.state || null,
      education: clean(resume.education) || candidate?.education || null,
      course: clean(resume.course) || candidate?.course || null,
      institution: clean(resume.institution) || candidate?.institution || null,
      lastRole: clean(resume.lastRole) || candidate?.lastRole || null,
      professionalSummary:
        clean(resume.professionalSummary || resume.resumeText) ||
        candidate?.professionalSummary ||
        null,
      experiences: {
        ...(candidate?.experiences && typeof candidate.experiences === "object"
          ? candidate.experiences
          : {}),
        aiInterviewResume: resume.experiences || [],
        texto: clean(resume.resumeText) || null,
      },
      skills: Array.isArray(resume.skills) ? resume.skills.map(String).filter(Boolean) : candidate?.skills || [],
      languages: Array.isArray(resume.languages) ? resume.languages.map(String).filter(Boolean) : candidate?.languages || [],
      resumeOrigin: candidate?.resumeOrigin || "entrevista_ia",
      aiSummary: clean(resume.professionalSummary || resume.resumeText).slice(0, 1000) || candidate?.aiSummary || null,
      aiExtractedData: {
        ...(candidate?.aiExtractedData && typeof candidate.aiExtractedData === "object"
          ? candidate.aiExtractedData
          : {}),
        entrevistaIaCurriculo: resume,
      },
      active: true,
    };

    if (candidate) {
      candidate = await prisma.candidateProfile.update({
        where: { id: candidate.id },
        data: candidateData,
      });
    } else {
      candidate = await prisma.candidateProfile.create({
        data: candidateData,
      });
    }

    const config = jobInterviewConfig(job);
    const adaptive = await callOpenAIJson(`
Crie perguntas adaptativas para entrevistar este candidato.

VAGA:
${JSON.stringify({
  title: job.title,
  description: job.description,
  requirements: job.requirements,
  workMode: job.workMode,
  contractType: job.contractType,
}, null, 2)}

PERFIL DESEJADO:
${config.profile || ""}

SINAIS POSITIVOS:
${config.positiveSignals || ""}

PONTOS DE ATENÇÃO PROFISSIONAIS:
${config.attentionSignals || ""}

CURRÍCULO EXTRAÍDO:
${JSON.stringify(resume, null, 2)}

ROTEIRO BASE:
${JSON.stringify(config.questions || [], null, 2)}

Crie 6 a 10 perguntas em sequência, personalizadas ao currículo.
Inclua ao menos:
- uma pergunta que valide resultado/metas citados no currículo, quando houver;
- uma pergunta situacional;
- uma pergunta sobre autonomia/organização se a vaga exigir trabalho remoto;
- uma pergunta específica sobre aderência ao tipo de contratação e remuneração, se isso for relevante.

Não pergunte nem avalie saúde, família, filhos, estado civil, situação financeira, idade, religião, raça/etnia, orientação sexual, deficiência ou outros atributos sensíveis.

Retorne:
{
  "questions": [
    {
      "id": "q1",
      "prompt": "",
      "purpose": "",
      "type": "text"
    }
  ]
}
`);

    const questions = Array.isArray(adaptive.questions) ? adaptive.questions : [];

    await prisma.$executeRawUnsafe(
      `
      UPDATE candidate_ai_interview_sessions
      SET
        candidate_id = $1,
        candidate_name = $2,
        candidate_email = NULLIF($3, ''),
        candidate_phone = $4,
        resume_file_name = $5,
        resume_storage_path = $10,
        resume_text = $6,
        resume_data = $7::jsonb,
        questions = $8::jsonb,
        status = 'interview',
        updated_at = now()
      WHERE session_token = $9
      `,
      candidate.id,
      candidate.name,
      email,
      phone,
      file.name,
      clean(resume.resumeText || resume.professionalSummary),
      JSON.stringify(resume),
      JSON.stringify(questions),
      sessionToken,
      storagePath
    );

    return NextResponse.json({
      success: true,
      candidate: {
        id: candidate.id,
        name: candidate.name,
      },
      resume,
      questions,
    });
  } catch (error: any) {
    console.error("PUBLIC AI INTERVIEW RESUME:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao analisar currículo." },
      { status: 500 }
    );
  }
}
