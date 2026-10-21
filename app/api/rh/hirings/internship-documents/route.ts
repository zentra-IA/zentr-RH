import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";
import { prisma } from "@/lib/prisma";
import { createLegalPdf } from "@/lib/rh-pdf";
import {
  buildAdtText,
  buildAgreementText,
  buildDttText,
  buildJourneyDeclarationText,
  buildRaText,
  buildTceText,
  calculateRaPeriods,
  type InternshipContext,
  type InternshipDocumentType,
} from "@/lib/internship-document-templates";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado.");
  return createClient(url, key);
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function firstValue(...values: any[]) {
  return values.find(
    (value) =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
  ) ?? "";
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

async function loadContext(
  supabase: ReturnType<typeof supabaseAdmin>,
  companyId: string,
  hiringId: string
): Promise<InternshipContext> {
  const { data: hiring, error: hiringError } = await supabase
    .from("rh_hirings")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", hiringId)
    .maybeSingle();

  if (hiringError) throw hiringError;
  if (!hiring) throw new Error("Contratação não encontrada.");

  let candidate: any = null;

  if (hiring.candidate_id) {
    candidate = await prisma.candidateProfile.findFirst({
      where: {
        id: hiring.candidate_id,
        company_id: companyId,
      },
    });
  }

  if (!candidate && (hiring.candidate_email || hiring.candidate_phone)) {
    candidate = await prisma.candidateProfile.findFirst({
      where: {
        company_id: companyId,
        OR: [
          ...(hiring.candidate_email
            ? [{ email: { equals: hiring.candidate_email, mode: "insensitive" as const } }]
            : []),
          ...(hiring.candidate_phone
            ? [
                { phone: hiring.candidate_phone },
                { mobile: hiring.candidate_phone },
              ]
            : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  const job = hiring.job_id
    ? await prisma.job.findFirst({
        where: { id: hiring.job_id, company_id: companyId },
      })
    : null;

  const openingId = firstValue(job?.opening_id, hiring.opening_id);
  const opening = openingId
    ? await prisma.rh_job_openings.findFirst({
        where: { id: openingId, company_id: companyId },
      })
    : null;

  const clientId = firstValue(job?.client_id, opening?.client_id);
  const client = clientId
    ? await prisma.company_contacts.findFirst({
        where: { id: clientId, company_id: companyId },
      })
    : null;

  const { data: contractDataRow, error: contractDataError } = await supabase
    .from("rh_hiring_contract_data")
    .select("data")
    .eq("company_id", companyId)
    .eq("hiring_id", hiringId)
    .maybeSingle();

  if (contractDataError) throw contractDataError;

  const automatic: Record<string, any> = {
    candidate_name: firstValue(hiring.candidate_name, candidate?.name),
    candidate_email: firstValue(hiring.candidate_email, candidate?.email),
    candidate_phone: firstValue(hiring.candidate_phone, candidate?.mobile, candidate?.phone),
    candidate_cpf: candidate?.cpf || "",
    candidate_rg: candidate?.rg || "",
    rg_number: candidate?.rg || "",
    candidate_birth_date: candidate?.birthDate
      ? candidate.birthDate.toISOString().slice(0, 10)
      : "",
    candidate_address: candidate?.address || "",
    candidate_neighborhood: candidate?.neighborhood || "",
    candidate_city: candidate?.city || "",
    candidate_state: candidate?.state || "",
    candidate_zip: candidate?.zipCode || "",
    institution_name: candidate?.institution || "",
    course_name: candidate?.course || "",
    education_level: candidate?.education || "",
    internship_start: hiring.contract_start || "",
    internship_end: hiring.contract_end || "",
    work_schedule: opening?.work_schedule || "",
    break_time: opening?.break_time || "",
    scholarship_amount: firstValue(hiring.salary, opening?.remuneration),
    transport_benefit: opening?.transport_benefit || "",
    activities: Array.isArray(opening?.activities)
      ? opening.activities.filter(Boolean).join("\n")
      : "",
    supervisor_name: opening?.direct_manager || "",

    company_name: firstValue(client?.company_name, client?.restaurant_name),
    company_cnpj: firstValue(client?.cnpj, client?.document),
    company_address: firstValue(client?.address),
    company_city: firstValue(client?.city),
    company_state: firstValue(client?.state),
    company_zip: firstValue(client?.cep),
    company_phone: firstValue(client?.phone, client?.whatsapp),
    company_email: firstValue(client?.email),
    company_representative: firstValue(client?.responsible_name, client?.owner_name),

    document_date: new Date().toISOString().slice(0, 10),
    insurance_company: "PORTO SEGURO CIA DE SEGUROS GERAIS",
    insurance_policy: "61.0862.98.000",
  };

  return {
    hiring,
    candidate,
    job,
    opening,
    client,
    data: {
      ...automatic,
      ...(contractDataRow?.data || {}),
    },
  };
}

function documentText(
  ctx: InternshipContext,
  documentType: InternshipDocumentType,
  reportNumber?: number
) {
  if (documentType === "tce") {
    return { content: buildTceText(ctx), reportPeriod: null };
  }

  if (documentType === "ra") {
    const periods = calculateRaPeriods(ctx);
    const wanted = Number(reportNumber || 1);
    const period =
      periods.find((item) => item.number === wanted) ||
      periods[wanted - 1];

    if (!period) {
      throw new Error(
        "Não foi possível calcular o período do RA. Confira as datas de início e fim do estágio."
      );
    }

    return {
      content: buildRaText(ctx, period),
      reportPeriod: period,
    };
  }

  if (documentType === "adt") {
    return { content: buildAdtText(ctx), reportPeriod: null };
  }

  if (documentType === "dtt") {
    return { content: buildDttText(ctx), reportPeriod: null };
  }

  if (documentType === "jornada") {
    return {
      content: buildJourneyDeclarationText(ctx),
      reportPeriod: null,
    };
  }

  if (documentType === "convenio") {
    return { content: buildAgreementText(ctx), reportPeriod: null };
  }

  throw new Error("Tipo de documento inválido.");
}

function fileLabel(type: InternshipDocumentType, reportNumber?: number) {
  if (type === "tce") return "tce";
  if (type === "ra") return `ra_${reportNumber || 1}`;
  if (type === "adt") return "aditivo_prorrogacao";
  if (type === "dtt") return "distrato";
  if (type === "jornada") return "declaracao_jornada";
  return "convenio_estagio";
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const hiringId = clean(new URL(req.url).searchParams.get("hiringId"));

    if (!hiringId) {
      return NextResponse.json(
        { error: "hiringId obrigatório." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const ctx = await loadContext(supabase, companyId, hiringId);

    const { data: generated, error } = await supabase
      .from("rh_hiring_generated_documents")
      .select("*")
      .eq("company_id", companyId)
      .eq("hiring_id", hiringId)
      .order("generated_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      raPeriods: calculateRaPeriods(ctx),
      generated: generated || [],
    });
  } catch (error: any) {
    console.error("GET INTERNSHIP DOCUMENTS ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar documentos de estágio." },
      { status: error?.message === "Contratação não encontrada." ? 404 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = await req.json();
    const hiringId = clean(body.hiringId);
    const documentType = clean(body.documentType) as InternshipDocumentType;
    const reportNumber = body.reportNumber ? Number(body.reportNumber) : undefined;

    if (!hiringId) {
      return NextResponse.json(
        { error: "hiringId obrigatório." },
        { status: 400 }
      );
    }

    if (!["tce", "ra", "adt", "dtt", "jornada", "convenio"].includes(documentType)) {
      return NextResponse.json(
        { error: "Tipo de documento inválido." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const ctx = await loadContext(supabase, companyId, hiringId);
    const { content, reportPeriod } = documentText(
      ctx,
      documentType,
      reportNumber
    );

    const pdfBytes = await createLegalPdf(content);
    const now = new Date().toISOString();

    const { error: saveError } = await supabase
      .from("rh_hiring_generated_documents")
      .insert({
        company_id: companyId,
        hiring_id: hiringId,
        document_type: documentType,
        report_number:
          documentType === "ra" ? reportNumber || reportPeriod?.number || null : null,
        period_start: reportPeriod?.start || null,
        period_end: reportPeriod?.end || null,
        template_version: "2026-10-19",
        snapshot_data: ctx.data,
        content_text: content,
        created_by: userId,
        generated_at: now,
      });

    if (saveError) throw saveError;

    await supabase.from("rh_hiring_events").insert({
      company_id: companyId,
      hiring_id: hiringId,
      actor_user_id: userId,
      event_type: "internship_document_generated",
      title:
        documentType === "ra"
          ? `RA ${reportNumber || reportPeriod?.number || 1} gerado`
          : `Documento de estágio gerado: ${documentType.toUpperCase()}`,
      description: reportPeriod
        ? `${reportPeriod.start} a ${reportPeriod.end}`
        : null,
      metadata: {
        document_type: documentType,
        report_number: reportNumber || reportPeriod?.number || null,
      },
    });

    const name = safeFileName(
      ctx.hiring?.candidate_name || ctx.candidate?.name || "candidato"
    );
    const filename = `${fileLabel(documentType, reportNumber)}_${name || hiringId}.pdf`;

    return new Response(Uint8Array.from(pdfBytes).buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: any) {
    console.error("POST INTERNSHIP DOCUMENT ERROR:", error);
    return new Response(
      error?.message || "Erro ao gerar documento de estágio.",
      { status: error?.message === "Contratação não encontrada." ? 404 : 500 }
    );
  }
}
