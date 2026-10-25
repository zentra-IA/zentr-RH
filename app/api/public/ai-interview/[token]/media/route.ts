import { NextRequest, NextResponse } from "next/server";
import {
  assertSessionPath, checkAiMedia, createAiMediaPath,
  downloadAiMedia, normalizeMime, storeAiMediaFallback,
} from "@/lib/ai-interview-media";
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

    const isJson = req.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await req.json() : await req.formData();
    const sessionToken = clean(isJson ? body.sessionToken : body.get("sessionToken"));
    const kind = clean(isJson ? body.kind : body.get("kind"));
    const uploadedPath = isJson ? clean(body.storagePath) : "";
    const originalFile = isJson ? null : body.get("file");

    if (!sessionToken || !["audio", "video"].includes(kind) ||
        (isJson ? !uploadedPath : !(originalFile instanceof File))) {
      return NextResponse.json(
        { error: "Sessão, tipo e arquivo são obrigatórios." },
        { status: 400 }
      );
    }
    const typedKind = kind as "audio" | "video";

    const rows = await prisma.$queryRaw<any[]>`
      SELECT "id", "status"
      FROM "candidate_ai_interview_sessions"
      WHERE "session_token" = ${sessionToken}
        AND "company_id"::text = ${String(job.company_id)}::text
        AND "job_id"::text = ${String(job.id)}::text
      LIMIT 1
    `;

    const session = rows[0];
    if (!session) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 404 });
    }
    if (session.status === "completed") {
      return NextResponse.json({ error: "Entrevista já concluída." }, { status: 409 });
    }

    let file: File;
    let storagePath: string;

    if (isJson) {
      storagePath = assertSessionPath(
        uploadedPath, String(job.company_id), String(session.id), typedKind
      );
      const stored = await downloadAiMedia(storagePath);
      const name = String(body.fileName || `${kind}.webm`).slice(0, 180);
      const mime = normalizeMime(stored.mime, name);
      checkAiMedia(typedKind, mime, stored.bytes.byteLength);
      file = new File([stored.bytes], name, { type: mime });
    } else {
      file = originalFile as File;
      const mime = normalizeMime(file.type, file.name);
      checkAiMedia(typedKind, mime, file.size);
      storagePath = createAiMediaPath(
        String(job.company_id), String(session.id), typedKind, mime
      );
      await storeAiMediaFallback(storagePath, file);
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
    const pathColumn = kind === "audio" ? "audio_storage_path" : "video_storage_path";

    await prisma.$executeRawUnsafe(
      `
      UPDATE candidate_ai_interview_sessions
      SET ${column} = $1, ${pathColumn} = $3, updated_at = now()
      WHERE session_token = $2
      `,
      transcript,
      sessionToken,
      storagePath
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
