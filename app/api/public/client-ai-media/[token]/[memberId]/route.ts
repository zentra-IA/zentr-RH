import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/ai-interview";
import { downloadAiMedia } from "@/lib/ai-interview-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function memberForToken(token: string, memberId: string) {
  if (!/^[a-zA-Z0-9_-]{12,160}$/.test(token) || !UUID.test(memberId)) {
    return null;
  }
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      m."candidate_name",
      s."resume_file_name",
      s."resume_storage_path",
      s."video_storage_path",
      s."audio_storage_path"
    FROM "rh_client_presentations" p
    JOIN "rh_client_presentation_candidates" m
      ON m."presentation_id"::text = p."id"::text
      AND m."company_id"::text = p."company_id"::text
    JOIN "candidate_ai_interview_sessions" s
      ON s."id"::text = m."ai_interview_session_id"::text
      AND s."company_id"::text = p."company_id"::text
      AND s."job_id"::text = p."job_id"::text
    WHERE p."token" = ${token}
      AND m."id"::text = ${memberId}::text
      AND p."workflow_status" IS DISTINCT FROM 'cancelled'
      AND p."workflow_status" IS DISTINCT FROM 'canceled'
      AND s."deleted_at" IS NULL
    LIMIT 1
  `;
  return rows[0] || null;
}

function typeForFile(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain; charset=utf-8",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    webm: "video/webm",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
  };
  return types[extension] || "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; memberId: string }> }
) {
  try {
    const { token, memberId } = await params;
    const row = await memberForToken(token, memberId);
    if (!row) {
      return NextResponse.json({ error: "Apresentação não encontrada." }, { status: 404 });
    }

    const kind = new URL(req.url).searchParams.get("kind") || "manifest";
    if (kind === "manifest") {
      return NextResponse.json({
        resume: Boolean(row.resume_storage_path),
        video: Boolean(row.video_storage_path),
        audio: Boolean(row.audio_storage_path),
        resumeName: row.resume_file_name || "Currículo",
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!["resume", "video"].includes(kind)) {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    }

    const path = String(kind === "resume" ? row.resume_storage_path || "" : row.video_storage_path || "");
    if (!path) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    const media = await downloadAiMedia(path);
    const contentType = typeForFile(path);
    const size = media.bytes.byteLength;
    const safeName = String(kind === "resume" ? row.resume_file_name || "curriculo" : "video-entrevista")
      .replace(/[^\w.\- ]/g, "_")
      .slice(0, 120);
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${kind === "video" || contentType === "application/pdf" ? "inline" : "attachment"}; filename="${safeName}"`,
    };

    const range = req.headers.get("range");
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      const suffix = m[1] === "" && m[2] !== "";
      const start = suffix ? Math.max(0, size - Number(m[2])) : Number(m[1] || 0);
      const end = suffix ? size - 1 : Math.min(size - 1, m[2] === "" ? size - 1 : Number(m[2]));
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const partial = media.bytes.slice(start, end + 1);
      return new Response(partial, {
        status: 206,
        headers: {
          ...headers,
          "Content-Length": String(partial.byteLength),
          "Content-Range": `bytes ${start}-${end}/${size}`,
        },
      });
    }

    return new Response(media.bytes, {
      status: 200,
      headers: { ...headers, "Content-Length": String(size) },
    });
  } catch (error: any) {
    console.error("CLIENT AI MEDIA:", error);
    return NextResponse.json({ error: "Não foi possível abrir a mídia." }, { status: 500 });
  }
}
