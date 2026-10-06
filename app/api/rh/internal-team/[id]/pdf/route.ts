import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";
import {
  buildInternalDocument,
  documentLabel,
  InternalDocumentType,
} from "@/lib/internal-rh-templates";
import { createInternalLegalPdf } from "@/lib/internal-rh-pdf";

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

const ALLOWED = new Set<InternalDocumentType>([
  "CONTRATO_TRABALHO",
  "REGIMENTO_COLABORADOR",
  "TCE",
  "REGIMENTO_ESTAGIARIO",
]);

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
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
    const documentType = searchParams.get("documentType") as
      | InternalDocumentType
      | null;
    const download = searchParams.get("download") === "1";

    if (!documentType || !ALLOWED.has(documentType)) {
      return new Response("Tipo de documento inválido.", { status: 400 });
    }

    const workers = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "rh_internal_workers"
      WHERE "id" = ${workerId}::uuid
        AND "company_id" = ${companyId}::uuid
      LIMIT 1
    `;

    const worker = workers[0];

    if (!worker) {
      return new Response("Colaborador não encontrado.", { status: 404 });
    }

    const snapshots = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "rh_internal_documents"
      WHERE "worker_id" = ${workerId}::uuid
        AND "company_id" = ${companyId}::uuid
        AND "document_type" = ${documentType}
      ORDER BY "generated_at" DESC
      LIMIT 1
    `;

    const content =
      snapshots[0]?.content_text ||
      buildInternalDocument(documentType, worker);

    const label = documentLabel(documentType);
    const pdfBytes = await createInternalLegalPdf(
      content,
      `${label} - ${worker.full_name}`
    );

    const filename = `${safeFilename(label)}_${safeFilename(
      worker.full_name
    )}.pdf`;

    // Next/TypeScript pode inferir o PDF como Uint8Array<ArrayBufferLike>,
    // enquanto Response exige um BodyInit baseado em ArrayBuffer.
    // Criamos uma cópia backed por ArrayBuffer para manter a tipagem compatível.
    const pdfBody = Uint8Array.from(pdfBytes).buffer;

    return new Response(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${
          download ? "attachment" : "inline"
        }; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: any) {
    console.error("GET internal-team PDF:", error);

    return new Response(
      error?.message || "Erro ao gerar documento.",
      { status: 500 }
    );
  }
}
