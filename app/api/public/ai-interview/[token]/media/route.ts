import { NextRequest, NextResponse } from "next/server";
import { clean, findJobByInterviewToken, prisma } from "@/lib/ai-interview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const form = await req.formData();
    const sessionToken = clean(form.get("sessionToken"));
    const kind = clean(form.get("kind"));
    const file = form.get("file");

    if (!sessionToken || !(file instanceof File) || !["audio", "video"].includes(kind)) {
      return NextResponse.json(
        { error: "Sessão, tipo e arquivo são obrigatórios." },
        { status: 400 }
      );
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id
      FROM candidate_ai_interview_sessions
      WHERE session_token = $1
        AND company_id = $2::uuid
        AND job_id = $3
      LIMIT 1
      `,
      sessionToken,
      job.company_id,
      job.id
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 404 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    fd.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });

    const raw = await response.text();
    if (!response.ok) throw new Error(raw);

    const payload = JSON.parse(raw);
    const transcript = String(payload.text || "").trim();

    const column = kind === "audio" ? "audio_transcript" : "video_transcript";

    await prisma.$executeRawUnsafe(
      `
      UPDATE candidate_ai_interview_sessions
      SET ${column} = $1, updated_at = now()
      WHERE session_token = $2
      `,
      transcript,
      sessionToken
    );

    return NextResponse.json({
      success: true,
      kind,
      transcript,
    });
  } catch (error: any) {
    console.error("PUBLIC AI INTERVIEW MEDIA:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao transcrever mídia." },
      { status: 500 }
    );
  }
}
