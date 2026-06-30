import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

function toArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function onlyDigits(value: any) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(value: any) {
  const digits = onlyDigits(value);

  if (!digits) return null;

  if (digits.startsWith("55") && digits.length >= 12) return digits;

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length > 11 && !digits.startsWith("55")) {
    return `55${digits}`;
  }

  return digits;
}

function normalizeStatus(status?: string | null) {
  const value = String(status || "novo").trim();

  const map: Record<string, string> = {
    novo: "novo",
    triagem: "triagem",
    entrevista: "entrevista",
    aprovado: "aprovado",
    banco_de_talentos: "banco_de_talentos",
    reprovado: "reprovado",
  };

  return map[value] || "novo";
}

function calculateAge(dateValue: any) {
  if (!dateValue) return null;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();

  let age = today.getFullYear() - date.getFullYear();

  const monthDiff = today.getMonth() - date.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < date.getDate())
  ) {
    age--;
  }

  if (age < 0 || age > 120) return null;

  return age;
}

function getCandidateAge(candidate: any) {
  const ai = candidate?.aiExtractedData || {};

  const aiAge = Number(ai.idade || ai.age);

  if (Number.isFinite(aiAge) && aiAge > 0 && aiAge <= 120) {
    return Math.round(aiAge);
  }

  return calculateAge(candidate.birthDate);
}

function birthDateRangeFromAge(ageMin?: number | null, ageMax?: number | null) {
  const today = new Date();

  const range: any = {};

  if (ageMin && ageMin > 0) {
    const maxBirthDate = new Date(today);
    maxBirthDate.setFullYear(today.getFullYear() - ageMin);
    range.lte = maxBirthDate;
  }

  if (ageMax && ageMax > 0) {
    const minBirthDate = new Date(today);
    minBirthDate.setFullYear(today.getFullYear() - ageMax - 1);
    minBirthDate.setDate(minBirthDate.getDate() + 1);
    range.gte = minBirthDate;
  }

  return Object.keys(range).length ? range : null;
}

function enrichCandidate(candidate: any) {
  const age = getCandidateAge(candidate);

  return {
    ...candidate,
    age,
    aiExtractedData: {
      ...(candidate.aiExtractedData || {}),
      ...(age ? { idade: age, age } : {}),
    },
  };
}

function filterByAge(candidates: any[], ageMin?: number | null, ageMax?: number | null) {
  if (!ageMin && !ageMax) return candidates;

  return candidates.filter((candidate) => {
    const age = getCandidateAge(candidate);

    if (!age) return false;
    if (ageMin && age < ageMin) return false;
    if (ageMax && age > ageMax) return false;

    return true;
  });
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await await requireCompany(req);

    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q")?.trim();
    const city = searchParams.get("city")?.trim();
    const education = searchParams.get("education")?.trim();
    const origin = searchParams.get("origin")?.trim();
    const status = searchParams.get("status")?.trim();

    const ageMin = Number(searchParams.get("ageMin") || "") || null;
    const ageMax = Number(searchParams.get("ageMax") || "") || null;

    console.log("RH_CANDIDATES_COMPANY_FILTER", {
      loggedCompanyId: companyId,
      publicApplyCompanyId: process.env.PUBLIC_APPLY_COMPANY_ID || null,
    });

    const publicApplyCompanyId = String(
      process.env.PUBLIC_APPLY_COMPANY_ID || ""
    ).trim();

    const companyIds = Array.from(
      new Set([companyId, publicApplyCompanyId].filter(Boolean))
    );

    const where: any = {
      company_id: {
        in: companyIds,
      },
      // Não filtramos active no banco porque candidatos do formulário público
      // podem chegar com active NULL dependendo da migration/default.
      // Filtramos em memória: só ocultamos explicitamente active === false.
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { cpf: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { neighborhood: { contains: q, mode: "insensitive" } },
        { education: { contains: q, mode: "insensitive" } },
        { course: { contains: q, mode: "insensitive" } },
        { lastRole: { contains: q, mode: "insensitive" } },
      ];
    }

    if (city) {
      where.OR = [
        ...(where.OR || []),
        { city: { contains: city, mode: "insensitive" } },
        { neighborhood: { contains: city, mode: "insensitive" } },
        { state: { contains: city, mode: "insensitive" } },
      ];
    }

    if (education) {
      where.OR = [
        ...(where.OR || []),
        { education: { contains: education, mode: "insensitive" } },
        { course: { contains: education, mode: "insensitive" } },
      ];
    }

    if (origin) {
      where.resumeOrigin = { contains: origin, mode: "insensitive" };
    }

    if (status) {
      where.status = normalizeStatus(status);
    }

    const birthDateRange = birthDateRangeFromAge(ageMin, ageMax);

    if (birthDateRange) {
      where.birthDate = birthDateRange;
    }

    const take = ageMin || ageMax ? 1000 : 300;

    const found = await prisma.candidateProfile.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take,
    });

    const visibleFound = found.filter((candidate: any) => candidate.active !== false);
    const candidates = filterByAge(visibleFound, ageMin, ageMax).map(enrichCandidate);

    const all = await prisma.candidateProfile.findMany({
      where: {
        company_id: {
          in: companyIds,
        },
      },
      select: {
        status: true,
        active: true,
      },
    });

    const visibleAll = all.filter((c: any) => c.active !== false);

    const stats = {
      total: visibleAll.length,
      novo: visibleAll.filter((c) => c.status === "novo").length,
      triagem: visibleAll.filter((c) => c.status === "triagem").length,
      entrevista: visibleAll.filter((c) => c.status === "entrevista").length,
      bancoTalentos: visibleAll.filter((c) => c.status === "banco_de_talentos").length,
    };

    return NextResponse.json({
      success: true,
      candidates,
      stats,
    });
  } catch (error: any) {
    console.error("ERRO GET CANDIDATES:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao buscar candidatos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = await await requireCompany(req);
    const body = await req.json();

    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Nome do candidato é obrigatório" },
        { status: 400 }
      );
    }

    const status = normalizeStatus(body.status);
    const phone = normalizePhone(body.phone);
    const mobile = normalizePhone(body.mobile) || phone;

    const birthDate = body.birthDate ? new Date(body.birthDate) : null;
    const age = calculateAge(birthDate);

    const candidate = await prisma.candidateProfile.create({
      data: {
        company_id: companyId,
        branch_id: branchId || null,
        active: true,

        name,
        cpf: body.cpf || null,
        birthDate,

        phone,
        mobile,
        email: body.email || null,

        city: body.city || null,
        state: body.state || null,
        neighborhood: body.neighborhood || null,
        zipCode: body.zipCode || null,

        education: body.education || null,
        course: body.course || null,
        courseStatus: body.courseStatus || null,
        lastRole: body.lastRole || null,

        skills: toArray(body.skills),
        languages: toArray(body.languages),

        experiences: {
          texto: body.experience || "",
        },

        resumeOrigin: body.resumeOrigin || "manual",
        status,

        aiExtractedData: {
          status,
          ...(age ? { idade: age, age } : {}),
        },

        rawImportData: {
          source: "manual",
          ...body,
        },
      },
    });

    return NextResponse.json({
      success: true,
      candidate: enrichCandidate(candidate),
    });
  } catch (error: any) {
    console.error("ERRO POST CANDIDATE:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao salvar candidato" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId } = await await requireCompany(req);
    const body = await req.json();

    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const existing = await prisma.candidateProfile.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Candidato não encontrado" }, { status: 404 });
    }

    const status = body.status ? normalizeStatus(body.status) : undefined;

    const birthDate =
      body.birthDate !== undefined
        ? body.birthDate
          ? new Date(body.birthDate)
          : null
        : undefined;

    const age = birthDate !== undefined ? calculateAge(birthDate) : undefined;

    const previousAi =
      existing.aiExtractedData && typeof existing.aiExtractedData === "object"
        ? existing.aiExtractedData
        : {};

    const candidate = await prisma.candidateProfile.update({
      where: {
        id,
      },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.cpf !== undefined && { cpf: body.cpf || null }),
        ...(birthDate !== undefined && { birthDate }),
        ...(body.phone !== undefined && { phone: normalizePhone(body.phone) }),
        ...(body.mobile !== undefined && {
          mobile: normalizePhone(body.mobile),
        }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.city !== undefined && { city: body.city || null }),
        ...(body.state !== undefined && { state: body.state || null }),
        ...(body.neighborhood !== undefined && {
          neighborhood: body.neighborhood || null,
        }),
        ...(body.zipCode !== undefined && { zipCode: body.zipCode || null }),
        ...(body.education !== undefined && {
          education: body.education || null,
        }),
        ...(body.course !== undefined && { course: body.course || null }),
        ...(body.courseStatus !== undefined && {
          courseStatus: body.courseStatus || null,
        }),
        ...(body.lastRole !== undefined && {
          lastRole: body.lastRole || null,
        }),
        ...(body.skills !== undefined && { skills: toArray(body.skills) }),
        ...(body.languages !== undefined && {
          languages: toArray(body.languages),
        }),
        ...((status || age !== undefined) && {
          aiExtractedData: {
            ...(previousAi as any),
            ...(status && { status }),
            ...(age !== undefined && age ? { idade: age, age } : {}),
          },
        }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({
      success: true,
      candidate: enrichCandidate(candidate),
    });
  } catch (error: any) {
    console.error("ERRO PATCH CANDIDATE:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar candidato" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { companyId } = await await requireCompany(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const candidate = await prisma.candidateProfile.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidato não encontrado" },
        { status: 404 }
      );
    }

    await prisma.candidateProfile.update({
      where: { id },
      data: {
        active: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("ERRO DELETE CANDIDATE:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao remover candidato" },
      { status: 500 }
    );
  }
}
