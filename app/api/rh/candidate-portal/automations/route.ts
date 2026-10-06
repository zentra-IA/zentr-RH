import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import { cleanPortalText } from "@/lib/candidate-portal-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function list(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanPortalText(item, 300)).filter(Boolean);
  }

  return String(value ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100);
}

function normalizeMatchType(value: unknown) {
  const match = cleanPortalText(value, 50);
  return ["contains", "exact", "starts_with"].includes(match)
    ? match
    : "contains";
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);

    const rows = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "candidate_portal_automations"
      WHERE "company_id" = ${companyId}::uuid
      ORDER BY
        "is_fallback" ASC,
        "priority" DESC,
        "updated_at" DESC
    `;

    return NextResponse.json({
      success: true,
      automations: rows,
    });
  } catch (error: any) {
    console.error("[CANDIDATE_AUTOMATIONS_GET]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao carregar automações." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = await req.json().catch(() => ({}));

    const name = cleanPortalText(body?.name, 200);
    const intent = cleanPortalText(body?.intent, 100) || null;
    const triggerKeywords = list(body?.triggerKeywords);
    const matchType = normalizeMatchType(body?.matchType);
    const responseText = cleanPortalText(body?.responseText, 5000);
    const responseVariations = list(body?.responseVariations);
    const isFallback = body?.isFallback === true;
    const priority = Math.max(-1000, Math.min(1000, Number(body?.priority || 0)));
    const active = body?.active !== false;

    if (!name || !responseText) {
      return NextResponse.json(
        { success: false, error: "Informe nome e resposta da automação." },
        { status: 400 }
      );
    }

    if (!isFallback && !triggerKeywords.length && !intent) {
      return NextResponse.json(
        {
          success: false,
          error: "Informe palavras-chave, intenção ou marque como resposta padrão.",
        },
        { status: 400 }
      );
    }

    if (isFallback) {
      await prisma.$executeRaw`
        UPDATE "candidate_portal_automations"
        SET "is_fallback" = false, "updated_at" = now()
        WHERE "company_id" = ${companyId}::uuid
          AND "is_fallback" = true
      `;
    }

    const rows = await prisma.$queryRaw<any[]>`
      INSERT INTO "candidate_portal_automations" (
        "company_id",
        "name",
        "intent",
        "trigger_keywords",
        "match_type",
        "response_text",
        "response_variations",
        "is_fallback",
        "priority",
        "active",
        "created_by"
      )
      VALUES (
        ${companyId}::uuid,
        ${name},
        ${intent},
        ${triggerKeywords}::text[],
        ${matchType},
        ${responseText},
        ${responseVariations}::text[],
        ${isFallback},
        ${priority},
        ${active},
        ${userId || null}
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, automation: rows[0] });
  } catch (error: any) {
    console.error("[CANDIDATE_AUTOMATIONS_POST]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao criar automação." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const body = await req.json().catch(() => ({}));
    const id = cleanPortalText(body?.id, 100);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Automação não informada." },
        { status: 400 }
      );
    }

    if (body?.toggleOnly === true) {
      const active = body?.active === true;

      const rows = await prisma.$queryRaw<any[]>`
        UPDATE "candidate_portal_automations"
        SET "active" = ${active}, "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
        RETURNING *
      `;

      if (!rows.length) {
        return NextResponse.json(
          { success: false, error: "Automação não encontrada." },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, automation: rows[0] });
    }

    const name = cleanPortalText(body?.name, 200);
    const intent = cleanPortalText(body?.intent, 100) || null;
    const triggerKeywords = list(body?.triggerKeywords);
    const matchType = normalizeMatchType(body?.matchType);
    const responseText = cleanPortalText(body?.responseText, 5000);
    const responseVariations = list(body?.responseVariations);
    const isFallback = body?.isFallback === true;
    const priority = Math.max(-1000, Math.min(1000, Number(body?.priority || 0)));
    const active = body?.active !== false;

    if (!name || !responseText) {
      return NextResponse.json(
        { success: false, error: "Informe nome e resposta." },
        { status: 400 }
      );
    }

    if (isFallback) {
      await prisma.$executeRaw`
        UPDATE "candidate_portal_automations"
        SET "is_fallback" = false, "updated_at" = now()
        WHERE "company_id" = ${companyId}::uuid
          AND "id" <> ${id}::uuid
          AND "is_fallback" = true
      `;
    }

    const rows = await prisma.$queryRaw<any[]>`
      UPDATE "candidate_portal_automations"
      SET
        "name" = ${name},
        "intent" = ${intent},
        "trigger_keywords" = ${triggerKeywords}::text[],
        "match_type" = ${matchType},
        "response_text" = ${responseText},
        "response_variations" = ${responseVariations}::text[],
        "is_fallback" = ${isFallback},
        "priority" = ${priority},
        "active" = ${active},
        "updated_at" = now()
      WHERE "id" = ${id}::uuid
        AND "company_id" = ${companyId}::uuid
      RETURNING *
    `;

    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "Automação não encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, automation: rows[0] });
  } catch (error: any) {
    console.error("[CANDIDATE_AUTOMATIONS_PATCH]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao atualizar automação." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const id = cleanPortalText(req.nextUrl.searchParams.get("id"), 100);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Automação não informada." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      DELETE FROM "candidate_portal_automations"
      WHERE "id" = ${id}::uuid
        AND "company_id" = ${companyId}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[CANDIDATE_AUTOMATIONS_DELETE]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao excluir automação." },
      { status: 500 }
    );
  }
}
