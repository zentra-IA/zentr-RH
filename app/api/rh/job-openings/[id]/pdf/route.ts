import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";
import {
  buildContractText,
  buildOpeningSheetText,
} from "@/lib/rh-document-templates";
import { createLegalPdf } from "@/lib/rh-pdf";

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

export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompany(req);
    const params = await Promise.resolve(context.params);
    const id = params.id;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") === "contract" ? "contract" : "sheet";
    const download = searchParams.get("download") === "1";

    const opening = await prisma.rh_job_openings.findFirst({
      where: {
        id,
        company_id: companyId,
      },
      include: {
        client: true,
      },
    });

    if (!opening) {
      return new Response("Ficha não encontrada.", { status: 404 });
    }

    let content: string;

    if (type === "contract") {
      if (
        !["approved", "contract_generated", "contract_sent", "signed"].includes(
          opening.status
        )
      ) {
        return new Response(
          "O contrato só pode ser emitido após a aprovação da Ficha de Abertura.",
          { status: 409 }
        );
      }

      const snapshot = await prisma.rh_documents.findFirst({
        where: {
          opening_id: opening.id,
          company_id: companyId,
          document_type: "contract",
        },
        orderBy: {
          generated_at: "desc",
        },
      });

      content =
        snapshot?.content_text ||
        buildContractText(opening as any, opening.client as any);
    } else {
      const snapshot = await prisma.rh_documents.findFirst({
        where: {
          opening_id: opening.id,
          company_id: companyId,
          document_type: "opening_sheet",
        },
        orderBy: {
          generated_at: "desc",
        },
      });

      content =
        snapshot?.content_text ||
        buildOpeningSheetText(opening as any, opening.client as any);
    }

    const pdfBytes = await createLegalPdf(content);
    const safePosition = opening.position
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const filename =
      type === "contract"
        ? `contrato_${safePosition || opening.id}.pdf`
        : `ficha_abertura_${safePosition || opening.id}.pdf`;

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
    console.error("GET /api/rh/job-openings/[id]/pdf:", error);
    return new Response(
      error?.message || "Erro ao gerar documento.",
      { status: 500 }
    );
  }
}
