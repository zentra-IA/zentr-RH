import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";
import { emitOperationalEvent } from "@/lib/operational-events";
import {
  buildInternalDocument,
  documentsForWorkerType,
  InternalWorkerType,
} from "@/lib/internal-rh-templates";

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

const ALLOWED_TYPES = new Set<InternalWorkerType>(["CLT", "ESTAGIO"]);

const ALLOWED_STATUS = new Set([
  "CANDIDATO_NOVO",
  "EM_ANALISE",
  "APROVADO",
  "DOCUMENTOS_GERADOS",
  "AGUARDANDO_ASSINATURA",
  "CONTRATADO_ATIVO",
  "NAO_APROVADO",
  "INATIVO",
]);

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function numberOrNull(value: unknown) {
  if (value === "" || value == null) return null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function dateOrNull(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

async function getWorker(id: string, companyId: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT *
    FROM "rh_internal_workers"
    WHERE "id" = ${id}::uuid
      AND "company_id" = ${companyId}::uuid
    LIMIT 1
  `;

  return rows[0] || null;
}

async function getWorkerDetail(id: string, companyId: string) {
  const worker = await getWorker(id, companyId);
  if (!worker) return null;

  const documents = await prisma.$queryRaw<any[]>`
    SELECT
      "id",
      "document_type",
      "template_version",
      "status",
      "generated_at",
      "sent_at",
      "signed_at"
    FROM "rh_internal_documents"
    WHERE "worker_id" = ${id}::uuid
      AND "company_id" = ${companyId}::uuid
    ORDER BY "generated_at" DESC
  `;

  const signedFiles = await prisma.$queryRaw<any[]>`
    SELECT
      "id",
      "document_type",
      "original_name",
      "mime_type",
      "size_bytes",
      "created_at"
    FROM "rh_internal_signed_files"
    WHERE "worker_id" = ${id}::uuid
      AND "company_id" = ${companyId}::uuid
    ORDER BY "created_at" DESC
  `;

  const personalFiles = await prisma.$queryRaw<any[]>`
    SELECT
      "id",
      "category",
      "label",
      "original_name",
      "mime_type",
      "size_bytes",
      "created_at"
    FROM "rh_internal_personal_files"
    WHERE "worker_id" = ${id}::uuid
      AND "company_id" = ${companyId}::uuid
    ORDER BY "created_at" DESC
  `;

  return {
    ...worker,
    documents,
    signed_files: signedFiles,
    personal_files: personalFiles,
  };
}

function workerPayload(body: any) {
  const workerType = cleanText(body.workerType) as InternalWorkerType | null;

  if (!workerType || !ALLOWED_TYPES.has(workerType)) {
    throw new Error("Tipo de vínculo inválido.");
  }

  const fullName = cleanText(body.fullName);
  const cpf = digits(body.cpf);

  if (!fullName) {
    throw new Error("Nome completo é obrigatório.");
  }

  if (!cpf) {
    throw new Error("CPF é obrigatório.");
  }

  return {
    workerType,
    fullName,
    cpf,
    rg: cleanText(body.rg),
    ctps: cleanText(body.ctps),
    address: cleanText(body.address),
    city: cleanText(body.city),
    state: cleanText(body.state),
    email: cleanText(body.email),
    phone: cleanText(body.phone),

    jobTitle: cleanText(body.jobTitle),
    sector: cleanText(body.sector),
    salaryAmount: numberOrNull(body.salaryAmount),
    salaryWords: cleanText(body.salaryWords),
    weeklyHours: intOrNull(body.weeklyHours) || (workerType === "CLT" ? 44 : 30),

    mondaySchedule: cleanText(body.mondaySchedule),
    tuesdaySchedule: cleanText(body.tuesdaySchedule),
    wednesdaySchedule: cleanText(body.wednesdaySchedule),
    thursdaySchedule: cleanText(body.thursdaySchedule),
    fridaySchedule: cleanText(body.fridaySchedule),

    nonCompeteTerritory: cleanText(body.nonCompeteTerritory),

    courseName: cleanText(body.courseName),
    institutionName: cleanText(body.institutionName),
    institutionCnpj: cleanText(body.institutionCnpj),
    institutionAddress: cleanText(body.institutionAddress),
    semester: cleanText(body.semester),

    guardianName: cleanText(body.guardianName),
    guardianCpf: digits(body.guardianCpf) || null,

    internshipSchedule: cleanText(body.internshipSchedule),
    stipendAmount: numberOrNull(body.stipendAmount),
    stipendWords: cleanText(body.stipendWords),
    transportAmount: numberOrNull(body.transportAmount),
    transportWords: cleanText(body.transportWords),
    mealAmount: numberOrNull(body.mealAmount),
    mealWords: cleanText(body.mealWords),

    internshipStart: dateOrNull(body.internshipStart),
    internshipEnd: dateOrNull(body.internshipEnd),

    notes: cleanText(body.notes),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const id = cleanText(searchParams.get("id"));
    const search = cleanText(searchParams.get("search"));

    if (id) {
      const worker = await getWorkerDetail(id, companyId);

      if (!worker) {
        return NextResponse.json(
          { error: "Registro interno não encontrado." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        worker,
      });
    }

    const workers = search
      ? await prisma.$queryRaw<any[]>`
          SELECT *
          FROM "rh_internal_workers"
          WHERE "company_id" = ${companyId}::uuid
            AND (
              "full_name" ILIKE ${`%${search}%`}
              OR "cpf" ILIKE ${`%${digits(search) || search}%`}
              OR COALESCE("email", '') ILIKE ${`%${search}%`}
              OR COALESCE("phone", '') ILIKE ${`%${search}%`}
            )
          ORDER BY "updated_at" DESC, "created_at" DESC
          LIMIT 500
        `
      : await prisma.$queryRaw<any[]>`
          SELECT *
          FROM "rh_internal_workers"
          WHERE "company_id" = ${companyId}::uuid
          ORDER BY "updated_at" DESC, "created_at" DESC
          LIMIT 500
        `;

    return NextResponse.json({
      success: true,
      workers,
    });
  } catch (error: any) {
    console.error("GET /api/rh/internal-team:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao carregar equipe interna." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId, userId } = await requireCompany(req);
    const body = await req.json();
    const payload = workerPayload(body);

    const duplicate = await prisma.$queryRaw<any[]>`
      SELECT "id"
      FROM "rh_internal_workers"
      WHERE "company_id" = ${companyId}::uuid
        AND "cpf" = ${payload.cpf}
        AND "status" <> 'INATIVO'
      LIMIT 1
    `;

    if (duplicate.length) {
      return NextResponse.json(
        { error: "Já existe um registro ativo com este CPF." },
        { status: 409 }
      );
    }

    const rows = await prisma.$queryRaw<any[]>`
      INSERT INTO "rh_internal_workers" (
        "company_id",
        "branch_id",
        "worker_type",
        "full_name",
        "cpf",
        "rg",
        "ctps",
        "address",
        "city",
        "state",
        "email",
        "phone",
        "job_title",
        "sector",
        "salary_amount",
        "salary_words",
        "weekly_hours",
        "monday_schedule",
        "tuesday_schedule",
        "wednesday_schedule",
        "thursday_schedule",
        "friday_schedule",
        "non_compete_territory",
        "course_name",
        "institution_name",
        "institution_cnpj",
        "institution_address",
        "semester",
        "guardian_name",
        "guardian_cpf",
        "internship_schedule",
        "stipend_amount",
        "stipend_words",
        "transport_amount",
        "transport_words",
        "meal_amount",
        "meal_words",
        "internship_start",
        "internship_end",
        "notes"
      )
      VALUES (
        ${companyId}::uuid,
        ${branchId || null}::uuid,
        ${payload.workerType},
        ${payload.fullName},
        ${payload.cpf},
        ${payload.rg},
        ${payload.ctps},
        ${payload.address},
        ${payload.city},
        ${payload.state},
        ${payload.email},
        ${payload.phone},
        ${payload.jobTitle},
        ${payload.sector},
        ${payload.salaryAmount},
        ${payload.salaryWords},
        ${payload.weeklyHours},
        ${payload.mondaySchedule},
        ${payload.tuesdaySchedule},
        ${payload.wednesdaySchedule},
        ${payload.thursdaySchedule},
        ${payload.fridaySchedule},
        ${payload.nonCompeteTerritory},
        ${payload.courseName},
        ${payload.institutionName},
        ${payload.institutionCnpj},
        ${payload.institutionAddress},
        ${payload.semester},
        ${payload.guardianName},
        ${payload.guardianCpf},
        ${payload.internshipSchedule},
        ${payload.stipendAmount},
        ${payload.stipendWords},
        ${payload.transportAmount},
        ${payload.transportWords},
        ${payload.mealAmount},
        ${payload.mealWords},
        ${payload.internshipStart}::date,
        ${payload.internshipEnd}::date,
        ${payload.notes}
      )
      RETURNING *
    `;

    const worker = rows[0];

    await emitOperationalEvent(
      {
        companyId,
        branchId,
        userId,
        module: "equipe_interna",
        action: "internal_worker_created",
        entityType: "rh_internal_workers",
        entityId: worker.id,
        entityName: worker.full_name,
        description: `Criou cadastro interno de ${worker.full_name}`,
        after: worker as Record<string, unknown>,
        metadata: {
          workerType: worker.worker_type,
          cpf: worker.cpf,
        },
        eventKey: `internal-worker-created:${worker.id}`,
      },
      req
    );

    return NextResponse.json({
      success: true,
      worker,
    });
  } catch (error: any) {
    console.error("POST /api/rh/internal-team:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao cadastrar colaborador." },
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
      return NextResponse.json(
        { error: "ID é obrigatório." },
        { status: 400 }
      );
    }

    const current = await getWorker(id, companyId);

    if (!current) {
      return NextResponse.json(
        { error: "Registro não encontrado." },
        { status: 404 }
      );
    }

    if (action === "pipeline_stage") {
      const status = cleanText(body.status);

      if (!status || !ALLOWED_STATUS.has(status)) {
        return NextResponse.json(
          { error: "Etapa do funil inválida." },
          { status: 400 }
        );
      }

      const updated = await prisma.$queryRaw<any[]>`
        UPDATE "rh_internal_workers"
        SET
          "status" = ${status},
          "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
        RETURNING *
      `;

      await emitOperationalEvent(
        {
          companyId,
          branchId: branchId || current.branch_id || null,
          userId,
          module: "equipe_interna",
          action: "internal_worker_stage_changed",
          entityType: "rh_internal_workers",
          entityId: id,
          entityName: current.full_name,
          description: `Moveu ${current.full_name}: ${current.status} → ${status}`,
          before: current as Record<string, unknown>,
          after: updated[0] as Record<string, unknown>,
          metadata: { from: current.status, to: status },
          eventKey: `internal-worker-stage:${id}:${Date.now()}`,
        },
        req
      );

      return NextResponse.json({
        success: true,
        worker: updated[0],
      });
    }

    if (action === "update") {
      const payload = workerPayload({
        ...body,
        workerType: body.workerType || current.worker_type,
      });

      const rows = await prisma.$queryRaw<any[]>`
        UPDATE "rh_internal_workers"
        SET
          "worker_type" = ${payload.workerType},
          "full_name" = ${payload.fullName},
          "cpf" = ${payload.cpf},
          "rg" = ${payload.rg},
          "ctps" = ${payload.ctps},
          "address" = ${payload.address},
          "city" = ${payload.city},
          "state" = ${payload.state},
          "email" = ${payload.email},
          "phone" = ${payload.phone},
          "job_title" = ${payload.jobTitle},
          "sector" = ${payload.sector},
          "salary_amount" = ${payload.salaryAmount},
          "salary_words" = ${payload.salaryWords},
          "weekly_hours" = ${payload.weeklyHours},
          "monday_schedule" = ${payload.mondaySchedule},
          "tuesday_schedule" = ${payload.tuesdaySchedule},
          "wednesday_schedule" = ${payload.wednesdaySchedule},
          "thursday_schedule" = ${payload.thursdaySchedule},
          "friday_schedule" = ${payload.fridaySchedule},
          "non_compete_territory" = ${payload.nonCompeteTerritory},
          "course_name" = ${payload.courseName},
          "institution_name" = ${payload.institutionName},
          "institution_cnpj" = ${payload.institutionCnpj},
          "institution_address" = ${payload.institutionAddress},
          "semester" = ${payload.semester},
          "guardian_name" = ${payload.guardianName},
          "guardian_cpf" = ${payload.guardianCpf},
          "internship_schedule" = ${payload.internshipSchedule},
          "stipend_amount" = ${payload.stipendAmount},
          "stipend_words" = ${payload.stipendWords},
          "transport_amount" = ${payload.transportAmount},
          "transport_words" = ${payload.transportWords},
          "meal_amount" = ${payload.mealAmount},
          "meal_words" = ${payload.mealWords},
          "internship_start" = ${payload.internshipStart}::date,
          "internship_end" = ${payload.internshipEnd}::date,
          "notes" = ${payload.notes},
          "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
        RETURNING *
      `;

      return NextResponse.json({
        success: true,
        worker: rows[0],
      });
    }

    if (action === "approve") {
      const rows = await prisma.$queryRaw<any[]>`
        UPDATE "rh_internal_workers"
        SET "status" = 'APROVADO', "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
        RETURNING *
      `;

      return NextResponse.json({ success: true, worker: rows[0] });
    }

    if (action === "reject") {
      const rows = await prisma.$queryRaw<any[]>`
        UPDATE "rh_internal_workers"
        SET "status" = 'NAO_APROVADO', "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
        RETURNING *
      `;

      return NextResponse.json({ success: true, worker: rows[0] });
    }

    if (action === "generate_documents") {
      if (
        ![
          "APROVADO",
          "DOCUMENTOS_GERADOS",
          "AGUARDANDO_ASSINATURA",
          "CONTRATADO_ATIVO",
        ].includes(current.status)
      ) {
        return NextResponse.json(
          {
            error:
              "A contratação precisa estar aprovada antes da geração dos documentos.",
          },
          { status: 409 }
        );
      }

      const types = documentsForWorkerType(current.worker_type);

      for (const documentType of types) {
        const content = buildInternalDocument(documentType, current);

        await prisma.$executeRaw`
          INSERT INTO "rh_internal_documents" (
            "company_id",
            "worker_id",
            "document_type",
            "content_text"
          )
          VALUES (
            ${companyId}::uuid,
            ${id}::uuid,
            ${documentType},
            ${content}
          )
        `;
      }

      await prisma.$executeRaw`
        UPDATE "rh_internal_workers"
        SET
          "status" = 'DOCUMENTOS_GERADOS',
          "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
      `;

      const detail = await getWorkerDetail(id, companyId);

      return NextResponse.json({
        success: true,
        worker: detail,
      });
    }

    if (action === "mark_sent") {
      await prisma.$executeRaw`
        UPDATE "rh_internal_documents"
        SET
          "status" = CASE
            WHEN "status" = 'signed' THEN "status"
            ELSE 'sent'
          END,
          "sent_at" = CASE
            WHEN "sent_at" IS NULL THEN now()
            ELSE "sent_at"
          END
        WHERE "worker_id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
      `;

      await prisma.$executeRaw`
        UPDATE "rh_internal_workers"
        SET
          "status" = 'AGUARDANDO_ASSINATURA',
          "updated_at" = now()
        WHERE "id" = ${id}::uuid
          AND "company_id" = ${companyId}::uuid
      `;

      const detail = await getWorkerDetail(id, companyId);

      return NextResponse.json({
        success: true,
        worker: detail,
      });
    }

    return NextResponse.json(
      { error: "Ação inválida." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("PATCH /api/rh/internal-team:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar gestão interna." },
      { status: 500 }
    );
  }
}
