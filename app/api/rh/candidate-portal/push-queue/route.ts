import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/lib/server-company";
import { processCandidatePushQueue } from "@/lib/candidate-push-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const body = await req.json().catch(() => ({}));

    const result = await processCandidatePushQueue({
      companyId,
      limit: Math.min(Number(body?.limit || 200), 300),
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Erro ao processar fila Push.",
      },
      { status: 500 }
    );
  }
}
