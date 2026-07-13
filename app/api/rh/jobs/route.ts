import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function cleanText(value: unknown) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function cleanInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(String(value).replace(/\D/g, ""));

  return Number.isFinite(number) ? number : null;
}

function parseSkills(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildJobPayload(body: any, companyId: string, branchId?: string | null) {
  const skillsRequired = parseSkills(body.skillsRequired);
  const languagesRequired = parseSkills(body.languagesRequired);

  const ageMin = cleanInt(body.ageMin);
  const ageMax = cleanInt(body.ageMax);
  const openings = cleanInt(body.openings) || 1;
  const minExperienceMonths = cleanInt(body.minExperienceMonths);

  const clientId = cleanText(body.clientId);
  const clientName = cleanText(body.clientName) || cleanText(body.department);
  const responsibleUserId = cleanText(body.responsibleUserId);
  const responsibleName = cleanText(body.responsibleName);
  const priority = cleanText(body.priority) || "normal";
  const startDate = cleanText(body.startDate);
  const dueDate = cleanText(body.dueDate);
  const meetLink = cleanText(body.meetLink);
  const processDate = cleanText(body.processDate);
  const processTime = cleanText(body.processTime);

  const contractType = cleanText(body.contractType) || "clt";

  const educationRequired = cleanText(body.educationRequired);
  const educationCurrent = cleanText(body.educationCurrent);
  const courseStatus = cleanText(body.courseStatus);
  const courseArea = cleanText(body.courseArea);
  const studentYear = cleanText(body.studentYear);
  const experienceMode = cleanText(body.experienceMode) || "indiferente";

  const baseRequirements = {
    text: cleanText(body.requirementsText),
    openings,
    shift: cleanText(body.shift),

    clientId,
    clientName,
    responsibleUserId,
    responsibleName,
    priority,
    startDate,
    dueDate,
    meetLink,
    processDate,
    processTime,

    educationRequired,
    educationCurrent,
    courseStatus,
    courseArea,
    studentYear,

    experienceRequired: cleanText(body.experienceRequired),
    experienceMode,
    minExperienceMonths,

    skillsRequired,
    languagesRequired,

    ageMin,
    ageMax,
  };

  const baseFilters = {
    city: cleanText(body.city),
    state: cleanText(body.state),
    neighborhood: cleanText(body.neighborhood),
    region: cleanText(body.region) || "nenhuma",
    zipCode: cleanText(body.zipCode),

    contractType,
    workMode: cleanText(body.workMode),

    ageMin,
    ageMax,

    educationRequired,
    educationCurrent,
    courseStatus,
    courseArea,
    studentYear,

    experienceRequired: cleanText(body.experienceRequired),
    experienceMode,
    minExperienceMonths,

    skillsRequired,
    languagesRequired,
    shift: cleanText(body.shift),
    openings,

    clientId,
    clientName,
    responsibleUserId,
    responsibleName,
    priority,
    startDate,
    dueDate,
    meetLink,
    processDate,
    processTime,
  };

  return {
    company_id: companyId,
    branch_id: branchId || null,

    title: cleanText(body.title) || "",
    department: clientName,
    description: cleanText(body.description),

    city: cleanText(body.city),
    state: cleanText(body.state),
    neighborhood: cleanText(body.neighborhood),
    region: cleanText(body.region) || "nenhuma",
    zipCode: cleanText(body.zipCode),

    workMode: cleanText(body.workMode),
    contractType,

    salaryMin: cleanNumber(body.salaryMin),
    salaryMax: cleanNumber(body.salaryMax),

    status: cleanText(body.status) || "open",

    educationRequired,
    experienceRequired: cleanText(body.experienceRequired),
    skillsRequired,
    languagesRequired,

    requirements: baseRequirements,

    filters: baseFilters,

    aiCriteria: {
      raw: cleanText(body.requirementsText),
      title: cleanText(body.title),
      contractType,
      ageMin,
      ageMax,
      city: cleanText(body.city),
      state: cleanText(body.state),
      neighborhood: cleanText(body.neighborhood),
      region: cleanText(body.region) || "nenhuma",
      educationRequired,
      educationCurrent,
      courseStatus,
      courseArea,
      studentYear,
      experienceMode,
      minExperienceMonths,
      skillsRequired,
      languagesRequired,
      shift: cleanText(body.shift),
      clientId,
      clientName,
      responsibleUserId,
      responsibleName,
      priority,
      startDate,
      dueDate,
      meetLink,
      processDate,
      processTime,
      updatedAt: new Date().toISOString(),
      matcherVersion: "zentra-rh-job-criteria-v2",
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const jobs = await prisma.job.findMany({
      where: {
        company_id: companyId,
        ...(status && status !== "all" ? { status } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const stats = {
      total: jobs.length,
      open: jobs.filter((job) => job.status === "open").length,
      draft: jobs.filter((job) => job.status === "draft").length,
      paused: jobs.filter((job) => job.status === "paused").length,
      closed: jobs.filter((job) => job.status === "closed").length,
    };

    return NextResponse.json({
      success: true,
      jobs,
      stats,
    });
  } catch (error: any) {
    console.error("GET /api/rh/jobs:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao buscar vagas" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const duplicateFromId = cleanText(body.duplicateFromId);

    if (duplicateFromId) {
      const sourceJob = await prisma.job.findFirst({
        where: {
          id: duplicateFromId,
          company_id: companyId,
        },
      });

      if (!sourceJob) {
        return NextResponse.json(
          { error: "Vaga original não encontrada." },
          { status: 404 }
        );
      }

      const sourceRequirements =
        sourceJob.requirements && typeof sourceJob.requirements === "object"
          ? sourceJob.requirements
          : {};

      const sourceFilters =
        sourceJob.filters && typeof sourceJob.filters === "object"
          ? sourceJob.filters
          : {};

      const sourceAiCriteria =
        sourceJob.aiCriteria && typeof sourceJob.aiCriteria === "object"
          ? sourceJob.aiCriteria
          : {};

      const duplicatedPayload = buildJobPayload(
        {
          ...sourceJob,
          ...(sourceRequirements as any),
          ...(sourceFilters as any),
          ...(sourceAiCriteria as any),
          title: `${sourceJob.title} - Cópia`,
          status: "draft",
          requirementsText:
            (sourceRequirements as any).text ||
            (sourceAiCriteria as any).raw ||
            "",
          startDate: "",
          dueDate: "",
          meetLink: "",
          processDate: "",
          processTime: "",
        },
        companyId,
        branchId || sourceJob.branch_id
      );

      const duplicatedJob = await prisma.job.create({
        data: duplicatedPayload,
      });

      return NextResponse.json(
        {
          success: true,
          duplicated: true,
          job: duplicatedJob,
        },
        { status: 201 }
      );
    }

    const title = cleanText(body.title);

    if (!title) {
      return NextResponse.json(
        { error: "Título da vaga é obrigatório." },
        { status: 400 }
      );
    }

    const payload = buildJobPayload(body, companyId, branchId);

    const job = await prisma.job.create({
      data: payload,
    });

    return NextResponse.json(
      {
        success: true,
        job,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/rh/jobs:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao criar vaga" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const id = cleanText(body.id);

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const existingJob = await prisma.job.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existingJob) {
      return NextResponse.json(
        { error: "Vaga não encontrada." },
        { status: 404 }
      );
    }

    const previousRequirements =
      existingJob.requirements && typeof existingJob.requirements === "object"
        ? existingJob.requirements
        : {};

    const previousFilters =
      existingJob.filters && typeof existingJob.filters === "object"
        ? existingJob.filters
        : {};

    const previousAiCriteria =
      existingJob.aiCriteria && typeof existingJob.aiCriteria === "object"
        ? existingJob.aiCriteria
        : {};

    const payload = buildJobPayload(
      {
        ...existingJob,
        ...(previousRequirements as any),
        ...(previousFilters as any),
        ...(previousAiCriteria as any),
        ...body,
        requirementsText:
          body.requirementsText ||
          (previousRequirements as any).text ||
          (previousAiCriteria as any).raw ||
          "",
      },
      companyId,
      branchId || existingJob.branch_id
    );

    const updated = await prisma.job.updateMany({
      where: {
        id,
        company_id: companyId,
      },
      data: payload,
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Vaga não encontrada ou não pertence à empresa atual." },
        { status: 404 }
      );
    }

    const job = await prisma.job.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Vaga não encontrada após atualização." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error("PATCH /api/rh/jobs:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar vaga" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const existingJob = await prisma.job.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existingJob) {
      return NextResponse.json(
        { error: "Vaga não encontrada." },
        { status: 404 }
      );
    }

    const deleted = await prisma.job.deleteMany({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (deleted.count !== 1) {
      return NextResponse.json(
        { error: "Vaga não encontrada ou não pertence à empresa atual." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("DELETE /api/rh/jobs:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao excluir vaga" },
      { status: 500 }
    );
  }
}
