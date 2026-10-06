import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";
import { emitOperationalEvent } from "@/lib/operational-events";

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

const BUCKET = "rh-contracts";
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
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
      "Configure SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para armazenar contratos assinados."
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRole,
  };
}

function sanitizeFilename(name: string) {
  const pieces = name.split(".");
  const extension =
    pieces.length > 1
      ? `.${pieces.pop()!.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`
      : "";

  const baseName = pieces
    .join(".")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return `${baseName || "contrato_assinado"}${extension}`;
}

async function getOwnedOpening(id: string, companyId: string) {
  return prisma.rh_job_openings.findFirst({
    where: {
      id,
      company_id: companyId,
    },
  });
}

async function uploadStorage(
  storagePath: string,
  mimeType: string,
  bytes: ArrayBuffer
) {
  const { url, serviceRole } = storageConfig();

  const response = await fetch(
    `${url}/storage/v1/object/${BUCKET}/${storagePath}`,
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
      `Não foi possível salvar o contrato no Storage. ${message}`.trim()
    );
  }
}

async function removeStorage(storagePath: string) {
  const { url, serviceRole } = storageConfig();

  const response = await fetch(
    `${url}/storage/v1/object/${BUCKET}/${storagePath}`,
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
      `Não foi possível remover o arquivo do Storage. ${message}`.trim()
    );
  }
}

async function readStorage(storagePath: string) {
  const { url, serviceRole } = storageConfig();

  return fetch(
    `${url}/storage/v1/object/authenticated/${BUCKET}/${storagePath}`,
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

export async function POST(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { companyId, branchId, userId } = await requireCompany(req);
    const params = await Promise.resolve(context.params);
    const openingId = params.id;

    const opening = await getOwnedOpening(openingId, companyId);

    if (!opening) {
      return NextResponse.json(
        { error: "Ficha/vaga não encontrada." },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Selecione um arquivo." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            "Formato não permitido. Envie PDF, JPG, JPEG, PNG ou WEBP.",
        },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "O arquivo deve ter no máximo 15 MB." },
        { status: 400 }
      );
    }

    const safeName = sanitizeFilename(file.name);
    const storagePath = [
      companyId,
      opening.client_id,
      opening.id,
      `${Date.now()}_${safeName}`,
    ].join("/");

    await uploadStorage(
      storagePath,
      file.type,
      await file.arrayBuffer()
    );

    let saved;

    try {
      saved = await prisma.rh_signed_contract_files.create({
        data: {
          company_id: companyId,
          opening_id: opening.id,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: userId || null,
        },
      });
    } catch (error) {
      await removeStorage(storagePath).catch(() => {});
      throw error;
    }

    await emitOperationalEvent(
      {
        companyId,
        branchId: branchId || opening.branch_id || null,
        userId,
        module: "rh",
        action: "signed_contract_uploaded",
        entityType: "rh_signed_contract_files",
        entityId: saved.id,
        entityName: file.name,
        description: `Anexou contrato assinado da vaga ${opening.position}`,
        after: saved as unknown as Record<string, unknown>,
        metadata: {
          openingId: opening.id,
          clientId: opening.client_id,
          mimeType: file.type,
          sizeBytes: file.size,
        },
        eventKey: `signed-contract-uploaded:${saved.id}`,
      },
      req
    );

    return NextResponse.json({
      success: true,
      file: {
        id: saved.id,
        originalName: saved.original_name,
        mimeType: saved.mime_type,
        sizeBytes: saved.size_bytes,
        createdAt: saved.created_at,
      },
    });
  } catch (error: any) {
    console.error(
      "POST /api/rh/job-openings/[id]/signed-contract:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Erro ao salvar contrato assinado.",
      },
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
    const openingId = params.id;
    const { searchParams } = new URL(req.url);

    const fileId = searchParams.get("fileId");
    const download = searchParams.get("download") === "1";

    const opening = await getOwnedOpening(openingId, companyId);

    if (!opening) {
      return NextResponse.json(
        { error: "Ficha/vaga não encontrada." },
        { status: 404 }
      );
    }

    if (!fileId) {
      const files = await prisma.rh_signed_contract_files.findMany({
        where: {
          company_id: companyId,
          opening_id: openingId,
        },
        orderBy: {
          created_at: "desc",
        },
      });

      return NextResponse.json({
        success: true,
        files: files.map((file) => ({
          id: file.id,
          originalName: file.original_name,
          mimeType: file.mime_type,
          sizeBytes: file.size_bytes,
          createdAt: file.created_at,
        })),
      });
    }

    const file = await prisma.rh_signed_contract_files.findFirst({
      where: {
        id: fileId,
        company_id: companyId,
        opening_id: openingId,
      },
    });

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
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${
          download ? "attachment" : "inline"
        }; filename="${sanitizeFilename(file.original_name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: any) {
    console.error(
      "GET /api/rh/job-openings/[id]/signed-contract:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Erro ao abrir contrato assinado.",
      },
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
    const openingId = params.id;
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId é obrigatório." },
        { status: 400 }
      );
    }

    const opening = await getOwnedOpening(openingId, companyId);

    if (!opening) {
      return NextResponse.json(
        { error: "Ficha/vaga não encontrada." },
        { status: 404 }
      );
    }

    const file = await prisma.rh_signed_contract_files.findFirst({
      where: {
        id: fileId,
        company_id: companyId,
        opening_id: openingId,
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado." },
        { status: 404 }
      );
    }

    await removeStorage(file.storage_path);

    await prisma.rh_signed_contract_files.delete({
      where: {
        id: file.id,
      },
    });

    await emitOperationalEvent(
      {
        companyId,
        branchId: branchId || opening.branch_id || null,
        userId,
        module: "rh",
        action: "signed_contract_removed",
        entityType: "rh_signed_contract_files",
        entityId: file.id,
        entityName: file.original_name,
        description: `Removeu anexo de contrato assinado da vaga ${opening.position}`,
        before: file as unknown as Record<string, unknown>,
        metadata: {
          openingId,
          clientId: opening.client_id,
        },
        eventKey: `signed-contract-removed:${file.id}`,
      },
      req
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(
      "DELETE /api/rh/job-openings/[id]/signed-contract:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Erro ao remover contrato assinado.",
      },
      { status: 500 }
    );
  }
}
