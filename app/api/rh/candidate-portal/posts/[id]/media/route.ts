import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import { readCandidateMedia } from "@/lib/candidate-portal-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompany(req);
    const params = await Promise.resolve(context.params);

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        "media_path",
        "media_mime",
        "media_original_name"
      FROM "candidate_portal_posts"
      WHERE "id" = ${params.id}::uuid
        AND "company_id" = ${companyId}::uuid
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
        { success: false, error: "Imagem não encontrada no Storage." },
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
