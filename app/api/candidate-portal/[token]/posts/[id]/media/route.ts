import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCandidatePortalToken } from "@/lib/candidate-portal-access";
import { readCandidateMedia } from "@/lib/candidate-portal-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: {
    params:
      | { token: string; id: string }
      | Promise<{ token: string; id: string }>;
  }
) {
  try {
    const params = await Promise.resolve(context.params);
    const token = decodeURIComponent(params.token);
    const profile = await resolveCandidatePortalToken(token);

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        p."media_path",
        p."media_mime",
        p."media_original_name"
      FROM "candidate_portal_post_recipients" r
      INNER JOIN "candidate_portal_posts" p
        ON p."id" = r."post_id"
      WHERE r."profile_id" = ${profile.id}::uuid
        AND p."id" = ${params.id}::uuid
        AND p."active" = true
        AND (
          p."expires_at" IS NULL
          OR p."expires_at" >= now()
        )
      LIMIT 1
    `;

    const post = rows[0];

    if (!post?.media_path) {
      return NextResponse.json(
        { success: false, error: "Imagem não encontrada." },
        { status: 404 }
      );
    }

    const response = await readCandidateMedia(post.media_path);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Imagem indisponível." },
        { status: 404 }
      );
    }

    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": post.media_mime || "application/octet-stream",
        "Content-Disposition": `inline; filename="${String(
          post.media_original_name || "imagem"
        ).replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao abrir imagem." },
      { status: 500 }
    );
  }
}
