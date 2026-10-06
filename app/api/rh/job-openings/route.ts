import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";
import { emitOperationalEvent } from "@/lib/operational-events";
import {
  buildContractText,
  buildOpeningSheetText,
  RhContractType,
} from "@/lib/rh-document-templates";

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

const ALLOWED_TYPES = new Set<RhContractType>([
  "CLT",
  "ESTAGIO_MEDIO_TECNICO",
  "ESTAGIO_SUPERIOR",
]);

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function toInt(value: unknown, fallback?: number | null) {
  if (value === "" || value == null) return fallback ?? null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback ?? null;
}

function toFloat(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toActivities(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5);
  }

  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeOpening(opening: any) {
  return {
    id: opening.id,
    clientId: opening.client_id,
    jobId: opening.job_id,
    status: opening.status,
    contractType: opening.contract_type,
    position: opening.position,
    quantity: opening.quantity,
    department: opening.department || "",
    requestResponsible: opening.request_responsible || "",
    directManager: opening.direct_manager || "",
    workMode: opening.work_mode || "",
    workplaceAddress: opening.workplace_address || "",
    workSchedule: opening.work_schedule || "",
    breakTime: opening.break_time || "",
    remuneration: opening.remuneration,
    transportBenefit: opening.transport_benefit || "",
    mealBenefit: opening.meal_benefit || "",
    lifeInsurance: Boolean(opening.life_insurance),
    otherBenefits: opening.other_benefits || "",
    educationRequired: opening.education_required || "",
    courses: opening.courses || "",
    requiredSkills: opening.required_skills || "",
    desiredSkills: opening.desired_skills || "",
    softSkills: opening.soft_skills || "",
    activities: opening.activities || [],
    slaFirstCandidates: opening.sla_first_candidates || "",
    slaInterviews: opening.sla_interviews || "",
    slaClosing: opening.sla_closing || "",
    honorariumText: opening.honorarium_text || "",
    honorariumAmount: opening.honorarium_amount,
    honorariumWords: opening.honorarium_words || "",
    paymentDays: opening.payment_days,
    suspensionDays: opening.suspension_days,
    guaranteeDays: opening.guarantee_days,
    forumCity: opening.forum_city || "",
    forumState: opening.forum_state || "",
    sheetSentAt: opening.sheet_sent_at,
    approvedAt: opening.approved_at,
    contractGeneratedAt: opening.contract_generated_at,
    contractSentAt: opening.contract_sent_at,
    signedAt: opening.signed_at,
    createdAt: opening.created_at,
    updatedAt: opening.updated_at,
    signedFiles: (opening.signed_files || []).map((file: any) => ({
      id: file.id,
      originalName: file.original_name,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      createdAt: file.created_at,
    })),
  };
}

function buildOpeningPayload(body: any, companyId: string, branchId?: string | null) {
  const contractType = cleanText(body.contractType) as RhContractType | null;

  if (!contractType || !ALLOWED_TYPES.has(contractType)) {
    throw new Error("Tipo de contratação inválido.");
  }

  return {
    company_id: companyId,
    branch_id: branchId || null,
    client_id: cleanText(body.clientId)!,
    contract_type: contractType,
    position: cleanText(body.position)!,
    quantity: Math.max(1, toInt(body.quantity, 1) || 1),
    department: cleanText(body.department),
    request_responsible: cleanText(body.requestResponsible),
    direct_manager: cleanText(body.directManager),
    work_mode: cleanText(body.workMode),
    workplace_address: cleanText(body.workplaceAddress),
    work_schedule: cleanText(body.workSchedule),
    break_time: cleanText(body.breakTime),
    remuneration: toFloat(body.remuneration),
    transport_benefit: cleanText(body.transportBenefit),
    meal_benefit: cleanText(body.mealBenefit),
    life_insurance: Boolean(body.lifeInsurance),
    other_benefits: cleanText(body.otherBenefits),
    education_required: cleanText(body.educationRequired),
    courses: cleanText(body.courses),
    required_skills: cleanText(body.requiredSkills),
    desired_skills: cleanText(body.desiredSkills),
    soft_skills: cleanText(body.softSkills),
    activities: toActivities(body.activities),
    sla_first_candidates: cleanText(body.slaFirstCandidates),
    sla_interviews: cleanText(body.slaInterviews),
    sla_closing: cleanText(body.slaClosing),
    honorarium_text: cleanText(body.honorariumText),
    honorarium_amount: toFloat(body.honorariumAmount),
    honorarium_words: cleanText(body.honorariumWords),
    payment_days: toInt(body.paymentDays, 5),
    suspension_days: toInt(body.suspensionDays, 10),
    guarantee_days: toInt(
      body.guaranteeDays,
      contractType === "CLT" ? 45 : 30
    ),
    forum_city: cleanText(body.forumCity),
    forum_state: cleanText(body.forumState),
  };
}

async function getOwnedOpening(id: string, companyId: string) {
  return prisma.rh_job_openings.findFirst({
    where: {
      id,
      company_id: companyId,
    },
    include: {
      client: true,
      signed_files: {
        orderBy: { created_at: "desc" },
      },
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const clientId = cleanText(searchParams.get("clientId"));
    const id = cleanText(searchParams.get("id"));

    if (id) {
      const opening = await getOwnedOpening(id, companyId);

      if (!opening) {
        return NextResponse.json(
          { error: "Ficha de abertura não encontrada." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        opening: normalizeOpening(opening),
      });
    }

    const openings = await prisma.rh_job_openings.findMany({
      where: {
        company_id: companyId,
        ...(clientId ? { client_id: clientId } : {}),
      },
      include: {
        signed_files: {
          orderBy: { created_at: "desc" },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      take: 300,
    });

    return NextResponse.json({
      success: true,
      openings: openings.map(normalizeOpening),
    });
  } catch (error: any) {
    console.error("GET /api/rh/job-openings:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao buscar fichas de abertura." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId, userId } = await requireCompany(req);
    const body = await req.json();

    const clientId = cleanText(body.clientId);
    const position = cleanText(body.position);

    if (!clientId) {
      return NextResponse.json(
        { error: "Cliente é obrigatório." },
        { status: 400 }
      );
    }

    if (!position) {
      return NextResponse.json(
        { error: "Cargo/posição é obrigatório." },
        { status: 400 }
      );
    }

    const client = await prisma.company_contacts.findFirst({
      where: {
        id: clientId,
        company_id: companyId,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    const payload = buildOpeningPayload(body, companyId, branchId);

    const opening = await prisma.rh_job_openings.create({
      data: payload,
    });

    await prisma.company_contacts.updateMany({
      where: {
        id: clientId,
        company_id: companyId,
        rh_pipeline_stage: "CLIENTE_NOVO",
      },
      data: {
        rh_pipeline_stage: "AGUARDANDO_FICHA",
      },
    });

    await emitOperationalEvent(
      {
        companyId,
        branchId,
        userId,
        module: "rh",
        action: "job_opening_sheet_created",
        entityType: "rh_job_openings",
        entityId: opening.id,
        entityName: opening.position,
        description: `Criou ficha de abertura para ${opening.position}`,
        after: opening as unknown as Record<string, unknown>,
        metadata: {
          clientId,
          contractType: opening.contract_type,
          quantity: opening.quantity,
        },
        eventKey: `rh-opening-created:${opening.id}`,
      },
      req
    );

    return NextResponse.json({
      success: true,
      opening: normalizeOpening(opening),
    });
  } catch (error: any) {
    console.error("POST /api/rh/job-openings:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao criar ficha de abertura." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId, branchId, userId } = await requireCompany(req);
    const body = await req.json();

    const id = cleanText(body.id);
    const action = cleanText(body.action);

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const opening = await getOwnedOpening(id, companyId);

    if (!opening) {
      return NextResponse.json(
        { error: "Ficha de abertura não encontrada." },
        { status: 404 }
      );
    }

    if (action === "update") {
      if (!["draft", "sheet_sent"].includes(opening.status)) {
        return NextResponse.json(
          {
            error:
              "A ficha não pode mais ser alterada depois da aprovação. Crie uma nova solicitação para alterar o escopo.",
          },
          { status: 409 }
        );
      }

      const payload = buildOpeningPayload(
        { ...body, clientId: opening.client_id },
        companyId,
        branchId || opening.branch_id
      );

      const updated = await prisma.rh_job_openings.update({
        where: { id },
        data: payload,
      });

      return NextResponse.json({
        success: true,
        opening: normalizeOpening(updated),
      });
    }

    if (action === "send_sheet") {
      const sheetText = buildOpeningSheetText(opening as any, opening.client as any);

      await prisma.$transaction([
        prisma.rh_documents.create({
          data: {
            company_id: companyId,
            opening_id: opening.id,
            document_type: "opening_sheet",
            content_text: sheetText,
            status: "generated",
          },
        }),
        prisma.rh_job_openings.update({
          where: { id },
          data: {
            status: "sheet_sent",
            sheet_sent_at: new Date(),
          },
        }),
      ]);
    } else if (action === "approve_sheet") {
      if (!["draft", "sheet_sent"].includes(opening.status)) {
        return NextResponse.json(
          { error: "Esta ficha já foi aprovada." },
          { status: 409 }
        );
      }

      let jobId = opening.job_id;

      if (!jobId) {
        const client = opening.client;
        const contractType =
          opening.contract_type === "CLT"
            ? "clt"
            : "estagio";

        const job = await prisma.job.create({
          data: {
            company_id: companyId,
            branch_id: branchId || opening.branch_id || null,
            client_id: opening.client_id,
            opening_id: opening.id,
            title: opening.position,
            description: (opening.activities || []).join("\n"),
            department: opening.department,
            city: client.city,
            state: client.state,
            zipCode: client.cep,
            workMode: opening.work_mode?.toLowerCase() || null,
            contractType,
            salaryMin: opening.remuneration,
            salaryMax: opening.remuneration,
            educationRequired: opening.education_required,
            skillsRequired: String(opening.required_skills || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            status: "draft",
            requirements: {
              source: "rh_job_opening",
              clientId: opening.client_id,
              openingId: opening.id,
              workSchedule: opening.work_schedule,
              breakTime: opening.break_time,
              directManager: opening.direct_manager,
              desiredSkills: opening.desired_skills,
              softSkills: opening.soft_skills,
              benefits: {
                transport: opening.transport_benefit,
                meal: opening.meal_benefit,
                lifeInsurance: opening.life_insurance,
                other: opening.other_benefits,
              },
            },
          },
        });

        jobId = job.id;
      }

      await prisma.rh_job_openings.update({
        where: { id },
        data: {
          job_id: jobId,
          status: "approved",
          approved_at: new Date(),
        },
      });

      await prisma.company_contacts.updateMany({
        where: {
          id: opening.client_id,
          company_id: companyId,
        },
        data: {
          rh_pipeline_stage: "AGUARDANDO_CONTRATO",
        },
      });
    } else if (action === "generate_contract") {
      if (
        !["approved", "contract_generated", "contract_sent", "signed"].includes(
          opening.status
        )
      ) {
        return NextResponse.json(
          {
            error:
              "O contrato só pode ser gerado após a aprovação da Ficha de Abertura.",
          },
          { status: 409 }
        );
      }

      const contractText = buildContractText(
        opening as any,
        opening.client as any
      );

      await prisma.$transaction([
        prisma.rh_documents.create({
          data: {
            company_id: companyId,
            opening_id: opening.id,
            document_type: "contract",
            content_text: contractText,
            status: "generated",
          },
        }),
        prisma.rh_job_openings.update({
          where: { id },
          data: {
            status:
              opening.status === "approved"
                ? "contract_generated"
                : opening.status,
            contract_generated_at:
              opening.contract_generated_at || new Date(),
          },
        }),
      ]);
    } else if (action === "send_contract") {
      if (!["contract_generated", "contract_sent"].includes(opening.status)) {
        return NextResponse.json(
          { error: "Gere o contrato antes de marcá-lo como enviado." },
          { status: 409 }
        );
      }

      await prisma.$transaction([
        prisma.rh_job_openings.update({
          where: { id },
          data: {
            status: "contract_sent",
            contract_sent_at: new Date(),
          },
        }),
        prisma.rh_documents.updateMany({
          where: {
            opening_id: id,
            document_type: "contract",
          },
          data: {
            status: "sent",
            sent_at: new Date(),
          },
        }),
      ]);
    } else if (action === "mark_signed") {
      if (!["contract_generated", "contract_sent"].includes(opening.status)) {
        return NextResponse.json(
          { error: "O contrato ainda não está pronto para assinatura." },
          { status: 409 }
        );
      }

      const operations: any[] = [
        prisma.rh_job_openings.update({
          where: { id },
          data: {
            status: "signed",
            signed_at: new Date(),
          },
        }),
        prisma.rh_documents.updateMany({
          where: {
            opening_id: id,
            document_type: "contract",
          },
          data: {
            status: "signed",
            signed_at: new Date(),
          },
        }),
      ];

      if (opening.job_id) {
        operations.push(
          prisma.job.updateMany({
            where: {
              id: opening.job_id,
              company_id: companyId,
            },
            data: {
              status: "open",
            },
          })
        );
      }

      await prisma.$transaction(operations);

      await prisma.company_contacts.updateMany({
        where: {
          id: opening.client_id,
          company_id: companyId,
        },
        data: {
          rh_pipeline_stage: "CONTRATO_ASSINADO_ATIVO",
        },
      });
    } else {
      return NextResponse.json(
        { error: "Ação inválida." },
        { status: 400 }
      );
    }

    const updated = await getOwnedOpening(id, companyId);

    await emitOperationalEvent(
      {
        companyId,
        branchId: branchId || opening.branch_id || null,
        userId,
        module: "rh",
        action: `job_opening_${action}`,
        entityType: "rh_job_openings",
        entityId: opening.id,
        entityName: opening.position,
        description: `Atualizou o fluxo documental da vaga ${opening.position}: ${action}`,
        before: opening as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
        metadata: {
          clientId: opening.client_id,
          jobId: updated?.job_id || null,
          status: updated?.status || null,
        },
        eventKey: `rh-opening-${action}:${opening.id}:${Date.now()}`,
      },
      req
    );

    return NextResponse.json({
      success: true,
      opening: updated ? normalizeOpening(updated) : null,
    });
  } catch (error: any) {
    console.error("PATCH /api/rh/job-openings:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar ficha de abertura." },
      { status: 500 }
    );
  }
}
