import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import {
  buildCandidatePortalUrl,
  cleanPortalText,
  findCandidateByIdentity,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
  candidateVisibleCompanyIds,
} from "@/lib/candidate-portal-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ensurePreferences(companyId: string, profileId: string) {
  await prisma.$executeRaw`
    INSERT INTO "candidate_push_preferences" (
      "company_id",
      "profile_id"
    )
    VALUES (
      ${companyId}::uuid,
      ${profileId}::uuid
    )
    ON CONFLICT ("profile_id") DO NOTHING
  `;
}

async function profileById(id: string, companyId: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      p.*,
      EXISTS (
        SELECT 1
        FROM "candidate_push_subscriptions" s
        WHERE s."profile_id" = p."id"
          AND s."active" = true
      ) AS "push_active",
      (
        SELECT COUNT(*)::int
        FROM "candidate_push_subscriptions" s
        WHERE s."profile_id" = p."id"
          AND s."active" = true
      ) AS "active_devices"
    FROM "candidate_portal_profiles" p
    WHERE p."id" = ${id}::uuid
      AND p."company_id" = ${companyId}::uuid
    LIMIT 1
  `;

  return rows[0] || null;
}

async function upsertProfileFromInput(
  companyId: string,
  branchId: string | null,
  input: {
    candidateId?: string | null;
    fullName?: string | null;
    cpf?: string | null;
    phone?: string | null;
    email?: string | null;
  }
) {
  const match = await findCandidateByIdentity(companyId, input);
  const candidate = match.candidate;

  const cpf =
    normalizeCpf(input.cpf) ||
    normalizeCpf(candidate?.cpf);

  const phone =
    normalizePhone(input.phone) ||
    normalizePhone(candidate?.mobile) ||
    normalizePhone(candidate?.phone);

  const email =
    normalizeEmail(input.email) ||
    normalizeEmail(candidate?.email);

  const fullName =
    cleanPortalText(input.fullName || candidate?.name, 200) ||
    "Candidato";

  let existing: any = null;

  if (candidate?.id) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "candidate_portal_profiles"
      WHERE "company_id" = ${companyId}::uuid
        AND "candidate_id" = ${candidate.id}
      LIMIT 1
    `;
    existing = rows[0] || null;
  }

  if (!existing && cpf) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "candidate_portal_profiles"
      WHERE "company_id" = ${companyId}::uuid
        AND "cpf_normalized" = ${cpf}
      LIMIT 1
    `;
    existing = rows[0] || null;
  }

  if (existing) {
    const rows = await prisma.$queryRaw<any[]>`
      UPDATE "candidate_portal_profiles"
      SET
        "candidate_id" = COALESCE(${candidate?.id || null}, "candidate_id"),
        "full_name" = ${fullName},
        "cpf_normalized" = COALESCE(${cpf}, "cpf_normalized"),
        "phone_normalized" = COALESCE(${phone}, "phone_normalized"),
        "email_normalized" = COALESCE(${email}, "email_normalized"),
        "match_status" = ${match.status},
        "match_method" = ${match.method},
        "match_confidence" = ${match.confidence},
        "linked_at" = CASE
          WHEN ${candidate?.id || null}::text IS NOT NULL
          THEN COALESCE("linked_at", now())
          ELSE "linked_at"
        END,
        "updated_at" = now()
      WHERE "id" = ${existing.id}::uuid
      RETURNING *
    `;

    await ensurePreferences(companyId, existing.id);
    return rows[0];
  }

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO "candidate_portal_profiles" (
      "company_id",
      "branch_id",
      "candidate_id",
      "full_name",
      "cpf_normalized",
      "phone_normalized",
      "email_normalized",
      "match_status",
      "match_method",
      "match_confidence",
      "linked_at"
    )
    VALUES (
      ${companyId}::uuid,
      ${branchId}::uuid,
      ${candidate?.id || null},
      ${fullName},
      ${cpf},
      ${phone},
      ${email},
      ${match.status},
      ${match.method},
      ${match.confidence},
      ${candidate?.id ? new Date() : null}
    )
    RETURNING *
  `;

  const profile = rows[0];
  await ensurePreferences(companyId, profile.id);
  return profile;
}

function errorResponse(error: any) {
  console.error("[CANDIDATE_PORTAL_ADMIN]", error);

  return NextResponse.json(
    {
      success: false,
      error:
        error?.message ||
        "Erro ao processar Portal do Candidato.",
    },
    { status: 500 }
  );
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const q = cleanPortalText(req.nextUrl.searchParams.get("q"), 200);
    const status = cleanPortalText(
      req.nextUrl.searchParams.get("status"),
      80
    );

    const profiles = q
      ? await prisma.$queryRaw<any[]>`
          SELECT
            p.*,
            EXISTS (
              SELECT 1
              FROM "candidate_push_subscriptions" s
              WHERE s."profile_id" = p."id"
                AND s."active" = true
            ) AS "push_active",
            (
              SELECT COUNT(*)::int
              FROM "candidate_push_subscriptions" s
              WHERE s."profile_id" = p."id"
                AND s."active" = true
            ) AS "active_devices"
          FROM "candidate_portal_profiles" p
          WHERE p."company_id" = ${companyId}::uuid
            AND (
              p."full_name" ILIKE ${`%${q}%`}
              OR COALESCE(p."cpf_normalized",'') ILIKE ${`%${q.replace(/\D/g, "")}%`}
              OR COALESCE(p."phone_normalized",'') ILIKE ${`%${q.replace(/\D/g, "")}%`}
              OR COALESCE(p."email_normalized",'') ILIKE ${`%${q}%`}
            )
            AND (
              ${status || null}::text IS NULL
              OR p."portal_status" = ${status || null}
            )
          ORDER BY p."updated_at" DESC
          LIMIT 1000
        `
      : await prisma.$queryRaw<any[]>`
          SELECT
            p.*,
            EXISTS (
              SELECT 1
              FROM "candidate_push_subscriptions" s
              WHERE s."profile_id" = p."id"
                AND s."active" = true
            ) AS "push_active",
            (
              SELECT COUNT(*)::int
              FROM "candidate_push_subscriptions" s
              WHERE s."profile_id" = p."id"
                AND s."active" = true
            ) AS "active_devices"
          FROM "candidate_portal_profiles" p
          WHERE p."company_id" = ${companyId}::uuid
            AND (
              ${status || null}::text IS NULL
              OR p."portal_status" = ${status || null}
            )
          ORDER BY p."updated_at" DESC
          LIMIT 1000
        `;

    const statsRows = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE "portal_status" = 'ACTIVE'
        )::int AS portal_active,
        COUNT(*) FILTER (
          WHERE "match_status" = 'MATCHED'
        )::int AS linked,
        COUNT(*) FILTER (
          WHERE "match_status" <> 'MATCHED'
        )::int AS unlinked,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM "candidate_push_subscriptions" s
            WHERE s."profile_id" = p."id"
              AND s."active" = true
          )
        )::int AS push_active
      FROM "candidate_portal_profiles" p
      WHERE p."company_id" = ${companyId}::uuid
    `;

    const campaigns = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "candidate_push_campaigns"
      WHERE "company_id" = ${companyId}::uuid
      ORDER BY "created_at" DESC
      LIMIT 30
    `;

    return NextResponse.json({
      success: true,
      profiles,
      stats: statsRows[0] || {},
      campaigns,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json().catch(() => ({}));
    const action = cleanPortalText(body?.action, 80) || "create";

    if (action === "bulk_from_candidates") {
      const candidateIds: string[] = Array.isArray(body?.candidateIds)
        ? Array.from(
            new Set<string>(
              body.candidateIds
                .map((id: unknown) => cleanPortalText(id, 100))
                .filter(
                  (id: string): id is string =>
                    Boolean(id)
                )
            )
          ).slice(0, 500)
        : [];

      if (!candidateIds.length) {
        return NextResponse.json(
          { success: false, error: "Selecione candidatos." },
          { status: 400 }
        );
      }

      const visibleCompanies = candidateVisibleCompanyIds(companyId);
      const candidates = await prisma.candidateProfile.findMany({
        where: {
          id: { in: candidateIds },
          company_id: { in: visibleCompanies },
          active: true,
        },
      });

      const links: any[] = [];

      for (const candidate of candidates) {
        const profile = await upsertProfileFromInput(
          companyId,
          branchId || null,
          {
            candidateId: candidate.id,
            fullName: candidate.name,
            cpf: candidate.cpf,
            phone: candidate.mobile || candidate.phone,
            email: candidate.email,
          }
        );

        links.push({
          candidateId: candidate.id,
          name: candidate.name,
          phone: candidate.mobile || candidate.phone || null,
          email: candidate.email || null,
          portalStatus: profile.portal_status,
          link: buildCandidatePortalUrl(req.nextUrl.origin, profile),
        });
      }

      return NextResponse.json({
        success: true,
        created: links.length,
        links,
      });
    }

    const fullName = cleanPortalText(body?.fullName, 200);
    const cpf = normalizeCpf(body?.cpf);
    const phone = normalizePhone(body?.phone);
    const email = normalizeEmail(body?.email);

    if (!fullName && !cpf && !body?.candidateId) {
      return NextResponse.json(
        {
          success: false,
          error: "Informe nome/CPF ou selecione um candidato.",
        },
        { status: 400 }
      );
    }

    const profile = await upsertProfileFromInput(
      companyId,
      branchId || null,
      {
        candidateId: cleanPortalText(body?.candidateId, 100) || null,
        fullName,
        cpf,
        phone,
        email,
      }
    );

    return NextResponse.json({
      success: true,
      profile: await profileById(profile.id, companyId),
      link: buildCandidatePortalUrl(req.nextUrl.origin, profile),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const body = await req.json().catch(() => ({}));

    const id = cleanPortalText(body?.id, 100);
    const action = cleanPortalText(body?.action, 80);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Perfil não informado." },
        { status: 400 }
      );
    }

    const profile = await profileById(id, companyId);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Perfil não encontrado." },
        { status: 404 }
      );
    }

    if (action === "rotate_link") {
      const rows = await prisma.$queryRaw<any[]>`
        UPDATE "candidate_portal_profiles"
        SET
          "token_version" = "token_version" + 1,
          "access_active" = true,
          "portal_status" = CASE
            WHEN "portal_status" = 'INACTIVE' THEN 'LINK_READY'
            ELSE "portal_status"
          END,
          "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
        RETURNING *
      `;

      return NextResponse.json({
        success: true,
        profile: rows[0],
        link: buildCandidatePortalUrl(req.nextUrl.origin, rows[0]),
      });
    }

    if (action === "get_link") {
      return NextResponse.json({
        success: true,
        link: buildCandidatePortalUrl(req.nextUrl.origin, profile),
      });
    }

    if (action === "set_active") {
      const active = body?.active === true;

      await prisma.$executeRaw`
        UPDATE "candidate_portal_profiles"
        SET
          "access_active" = ${active},
          "portal_status" = ${active ? "LINK_READY" : "INACTIVE"},
          "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
      `;

      return NextResponse.json({
        success: true,
        profile: await profileById(id, companyId),
      });
    }

    if (action === "link_candidate") {
      const candidateId = cleanPortalText(body?.candidateId, 100);

      if (!candidateId) {
        return NextResponse.json(
          { success: false, error: "Candidato não informado." },
          { status: 400 }
        );
      }

      const match = await findCandidateByIdentity(companyId, {
        candidateId,
      });

      if (!match.candidate) {
        return NextResponse.json(
          { success: false, error: "Candidato não encontrado." },
          { status: 404 }
        );
      }

      await prisma.$executeRaw`
        UPDATE "candidate_portal_profiles"
        SET
          "candidate_id" = ${match.candidate.id},
          "full_name" = ${match.candidate.name},
          "cpf_normalized" = COALESCE(
            ${normalizeCpf(match.candidate.cpf)},
            "cpf_normalized"
          ),
          "phone_normalized" = COALESCE(
            ${normalizePhone(
              match.candidate.mobile || match.candidate.phone
            )},
            "phone_normalized"
          ),
          "email_normalized" = COALESCE(
            ${normalizeEmail(match.candidate.email)},
            "email_normalized"
          ),
          "match_status" = 'MATCHED',
          "match_method" = 'MANUAL',
          "match_confidence" = 100,
          "linked_at" = now(),
          "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
      `;

      return NextResponse.json({
        success: true,
        profile: await profileById(id, companyId),
      });
    }

    return NextResponse.json(
      { success: false, error: "Ação inválida." },
      { status: 400 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
