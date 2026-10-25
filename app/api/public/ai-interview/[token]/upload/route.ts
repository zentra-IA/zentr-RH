import { NextRequest, NextResponse } from "next/server";
import { clean, findJobByInterviewToken, prisma } from "@/lib/ai-interview";
import type { AiMediaKind } from "@/lib/ai-interview-media";
import {
  checkAiMedia, createAiMediaPath,
  normalizeMime, signedAiMediaUpload,
} from "@/lib/ai-interview-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const job = await findJobByInterviewToken(token);
    if (!job) return NextResponse.json({ error: "Entrevista não encontrada." }, { status: 404 });

    const body = await req.json();
    const sessionToken = clean(body.sessionToken);
    const kind: AiMediaKind = body.kind;
    const fileName = String(body.fileName || "").slice(0, 180);
    const mime = normalizeMime(String(body.contentType || ""), fileName);
    const size = Number(body.size);

    if (!["resume", "audio", "video"].includes(kind)) {
      return NextResponse.json({ error: "Tipo de arquivo inválido." }, { status: 400 });
    }
    checkAiMedia(kind, mime, size);
    if (!sessionToken) throw new Error("Sessão não informada.");

    const rows = await prisma.$queryRaw<any[]>`
      SELECT "id", "status"
      FROM "candidate_ai_interview_sessions"
      WHERE "session_token" = ${sessionToken}
        AND "company_id"::text = ${String(job.company_id)}::text
        AND "job_id"::text = ${String(job.id)}::text
        AND "status" <> 'completed'
      LIMIT 1
    `;
    const session = rows[0];
    if (!session) return NextResponse.json({ error: "Sessão inválida ou concluída." }, { status: 404 });

    const storagePath = createAiMediaPath(String(job.company_id), String(session.id), kind, mime);
    const uploadUrl = await signedAiMediaUpload(storagePath);

    return NextResponse.json({ success: true, uploadUrl, storagePath, mime });
  } catch (error: any) {
    console.error("AI INTERVIEW SIGN MEDIA:", error);
    return NextResponse.json({ error: error?.message || "Erro ao autorizar arquivo." }, { status: 400 });
  }
}
