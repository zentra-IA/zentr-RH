import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCandidatePortalToken } from "@/lib/candidate-portal-access";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const token = decodeURIComponent(params.token);
    const profile = await resolveCandidatePortalToken(token);

    if (!profile.identity_confirmed_at) {
      return NextResponse.json(
        { success: false, error: "Confirme sua identidade primeiro." },
        { status: 401 }
      );
    }

    const posts = await prisma.$queryRaw<any[]>`
      SELECT
        p."id",
        p."title",
        p."body",
        p."content_type",
        p."expires_at",
        p."media_path",
        p."media_mime",
        p."published_at",
        r."viewed_at"
      FROM "candidate_portal_post_recipients" r
      INNER JOIN "candidate_portal_posts" p
        ON p."id" = r."post_id"
      WHERE r."profile_id" = ${profile.id}::uuid
        AND p."active" = true
        AND (
          p."expires_at" IS NULL
          OR p."expires_at" >= now()
        )
      ORDER BY p."published_at" DESC
      LIMIT 100
    `;

    return NextResponse.json({
      success: true,
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        body: post.body,
        contentType: post.content_type || "NOVIDADE",
        expiresAt: post.expires_at,
        publishedAt: post.published_at,
        viewedAt: post.viewed_at,
        hasImage: Boolean(post.media_path),
        imageUrl: post.media_path
          ? `/api/candidate-portal/${encodeURIComponent(
              token
            )}/posts/${post.id}/media`
          : null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message === "PORTAL_TOKEN_INVALID" ||
          error?.message === "PORTAL_ACCESS_NOT_FOUND"
            ? "Link inválido ou desativado."
            : error?.message || "Erro ao carregar novidades.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const token = decodeURIComponent(params.token);
    const profile = await resolveCandidatePortalToken(token);
    const body = await req.json().catch(() => ({}));
    const postId = String(body?.postId || "").trim();

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "Publicação não informada." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE "candidate_portal_post_recipients"
      SET "viewed_at" = COALESCE("viewed_at", now())
      WHERE "post_id" = ${postId}::uuid
        AND "profile_id" = ${profile.id}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao registrar visualização." },
      { status: 500 }
    );
  }
}
