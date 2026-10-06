import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";
import { emitOperationalEvent } from "@/lib/operational-events";
import {
  documentsForWorkerType,
  InternalDocumentType,
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

const BUCKET = "rh-internal-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_DOCUMENT_TYPES = new Set<InternalDocumentType>([
  "CONTRATO_TRABALHO",
  "REGIMENTO_COLABORADOR",
  "TCE",
  "REGIMENTO_ESTAGIARIO",
]);

function storageConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Storage não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env."
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRole,
  };
}

function sanitizeFilename(name: string) {
  const parts = name.split(".");
  const extension =
    parts.length > 1
      ? `.${parts.pop()!.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`
      : "";

  const base = parts
    .join(".")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return `${base || "documento_assinado"}${extension}`;
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

async function uploadStorage(
  path: string,
  mimeType: string,
  bytes: ArrayBuffer
) {
  const { url, serviceRole } = storageConfig();

  const response = await fetch(
    `${url}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": mimeType,
        "x-upsert": "false",
      },
      body: Buffer.from(bytes),
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Não foi possível salvar o arquivo no Storage. ${message}`.trim()
    );
  }
}

async function readStorage(path: string) {
  const { url, serviceRole } = storageConfig();

  return fetch(
    `${url}/storage/v1/object/authenticated/${BUCKET}/${path}`,
    {
      method: "GET",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
      cache: "no-store",
    }
  );
}

async function deleteStorage(path: string) {
  const { url, serviceRole } = storageConfig();

  const response = await fetch(
    `${url}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Não foi possível remover o arquivo. ${message}`.trim()
    );
  }
}

async function refreshWorkerStatus(worker: any, companyId: string) {
  const required = documentsForWorkerType(worker.worker_type);

  const rows = await prisma.$queryRaw<any[]>`
    SELECT DISTINCT "document_type"
    FROM "rh_internal_signed_files"
    WHERE "worker_id" = ${worker.id}::uuid
      AND "company_id" = ${companyId}::uuid
  `;

  const present = new Set(rows.map((row) => row.document_type));
  const complete = required.every((type) => present.has(type));

  if (!complete) {
    if (worker.status === "CONTRATADO_ATIVO") {
      await prisma.$executeRaw`
        UPDATE "rh_internal_workers"
        SET
          "status" = 'AGUARDANDO_ASSINATURA',
          "updated_at" = now()
        WHERE "id" = ${worker.id}::uuid
          AND "company_id" = ${companyId}::uuid
      `;
    }

    return false;
  }

  await prisma.$executeRaw`
    UPDATE "rh_internal_workers"
    SET
      "status" = 'CONTRATADO_ATIVO',
      "updated_at" = now()
    WHERE "id" = ${worker.id}::uuid
      AND "company_id" = ${companyId}::uuid
  `;

  for (const type of required) {
    await prisma.$executeRaw`
      UPDATE "rh_internal_documents"
      SET
        "status" = 'signed',
        "signed_at" = COALESCE("signed_at", now())
      WHERE "worker_id" = ${worker.id}::uuid
        AND "company_id" = ${companyId}::uuid
        AND "document_type" = ${type}
    `;
  }

  return true;
}

export async function POST(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { companyId, branchId, userId } = await requireCompany(req);
    const params = await Promise.resolve(context.params);
    const workerId = params.id;

    const worker = await getWorker(workerId, companyId);

    if (!worker) {
      return NextResponse.json(
        { error: "Colaborador não encontrado." },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const documentType = String(formData.get("documentType") || "") as
      | InternalDocumentType
      | "";

    if (!documentType || !ALLOWED_DOCUMENT_TYPES.has(documentType as InternalDocumentType)) {
      return NextResponse.json(
        { error: "Selecione o tipo correto do documento assinado." },
        { status: 400 }
      );
    }

    const allowedForWorker = documentsForWorkerType(worker.worker_type);

    if (!allowedForWorker.includes(documentType as InternalDocumentType)) {
      return NextResponse.json(
        { error: "Este documento não pertence ao tipo de vínculo selecionado." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Selecione um arquivo." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Envie PDF, JPG, PNG ou WEBP." },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "O arquivo deve ter no máximo 15 MB." },
        { status: 400 }
      );
    }

    const safe = sanitizeFilename(file.name);
    const storagePath = [
      companyId,
      worker.id,
      documentType,
      `${Date.now()}_${safe}`,
    ].join("/");

    await uploadStorage(
      storagePath,
      file.type,
      await file.arrayBuffer()
    );

    let saved: any;

    try {
      const rows = await prisma.$queryRaw<any[]>`
        INSERT INTO "rh_internal_signed_files" (
          "company_id",
          "worker_id",
          "document_type",
          "storage_bucket",
          "storage_path",
          "original_name",
          "mime_type",
          "size_bytes",
          "uploaded_by"
        )
        VALUES (
          ${companyId}::uuid,
          ${worker.id}::uuid,
          ${documentType},
          ${BUCKET},
          ${storagePath},
          ${file.name},
          ${file.type},
          ${file.size},
          ${userId || null}
        )
        RETURNING *
      `;

      saved = rows[0];
    } catch (error) {
      await deleteStorage(storagePath).catch(() => {});
      throw error;
    }

    const activated = await refreshWorkerStatus(worker, companyId);

    await emitOperationalEvent(
      {
        companyId,
        branchId: branchId || worker.branch_id || null,
        userId,
        module: "equipe_interna",
        action: "internal_signed_document_uploaded",
        entityType: "rh_internal_signed_files",
        entityId: saved.id,
        entityName: file.name,
        description: `Anexou documento assinado de ${worker.full_name}`,
        after: saved as Record<string, unknown>,
        metadata: {
          workerId: worker.id,
          documentType,
          activated,
        },
        eventKey: `internal-signed-upload:${saved.id}`,
      },
      req
    );

    return NextResponse.json({
      success: true,
      activated,
      file: {
        id: saved.id,
        documentType: saved.document_type,
        originalName: saved.original_name,
        mimeType: saved.mime_type,
        sizeBytes: saved.size_bytes,
        createdAt: saved.created_at,
      },
    });
  } catch (error: any) {
    console.error("POST internal signed document:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao salvar documento assinado." },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompany(req);
    const params = await Promise.resolve(context.params);
    const workerId = params.id;

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    const download = searchParams.get("download") === "1";

    const worker = await getWorker(workerId, companyId);

    if (!worker) {
      return NextResponse.json(
        { error: "Colaborador não encontrado." },
        { status: 404 }
      );
    }

    if (!fileId) {
      const files = await prisma.$queryRaw<any[]>`
        SELECT
          "id",
          "document_type",
          "original_name",
          "mime_type",
          "size_bytes",
          "created_at"
        FROM "rh_internal_signed_files"
        WHERE "worker_id" = ${workerId}::uuid
          AND "company_id" = ${companyId}::uuid
        ORDER BY "created_at" DESC
      `;

      return NextResponse.json({
        success: true,
        files,
      });
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "rh_internal_signed_files"
      WHERE "id" = ${fileId}::uuid
        AND "worker_id" = ${workerId}::uuid
        AND "company_id" = ${companyId}::uuid
      LIMIT 1
    `;

    const file = rows[0];

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado." },
        { status: 404 }
      );
    }

    const storageResponse = await readStorage(file.storage_path);

    if (!storageResponse.ok) {
      return NextResponse.json(
        { error: "Arquivo não encontrado no Storage." },
        { status: 404 }
      );
    }

    const bytes = await storageResponse.arrayBuffer();

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": file.mime_type,
        "Content-Disposition": `${
          download ? "attachment" : "inline"
        }; filename="${sanitizeFilename(file.original_name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: any) {
    console.error("GET internal signed document:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao abrir documento." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { companyId, branchId, userId } = await requireCompany(req);
    const params = await Promise.resolve(context.params);
    const workerId = params.id;

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId é obrigatório." },
        { status: 400 }
      );
    }

    const worker = await getWorker(workerId, companyId);

    if (!worker) {
      return NextResponse.json(
        { error: "Colaborador não encontrado." },
        { status: 404 }
      );
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "rh_internal_signed_files"
      WHERE "id" = ${fileId}::uuid
        AND "worker_id" = ${workerId}::uuid
        AND "company_id" = ${companyId}::uuid
      LIMIT 1
    `;

    const file = rows[0];

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado." },
        { status: 404 }
      );
    }

    await deleteStorage(file.storage_path);

    await prisma.$executeRaw`
      DELETE FROM "rh_internal_signed_files"
      WHERE "id" = ${fileId}::uuid
        AND "company_id" = ${companyId}::uuid
    `;

    await refreshWorkerStatus(worker, companyId);

    await emitOperationalEvent(
      {
        companyId,
        branchId: branchId || worker.branch_id || null,
        userId,
        module: "equipe_interna",
        action: "internal_signed_document_removed",
        entityType: "rh_internal_signed_files",
        entityId: file.id,
        entityName: file.original_name,
        description: `Removeu documento assinado de ${worker.full_name}`,
        before: file as Record<string, unknown>,
        metadata: {
          workerId,
          documentType: file.document_type,
        },
        eventKey: `internal-signed-remove:${file.id}`,
      },
      req
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE internal signed document:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao remover documento." },
      { status: 500 }
    );
  }
}
