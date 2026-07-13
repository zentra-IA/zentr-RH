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

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeClient(contact: any) {
  return {
    id: contact.id,
    name: contact.company_name || contact.restaurant_name || "",
    companyName: contact.company_name || contact.restaurant_name || "",
    cnpj: contact.cnpj || contact.document || "",
    responsibleName: contact.responsible_name || contact.owner_name || "",
    whatsapp: contact.whatsapp || contact.phone || "",
    phone: contact.phone || contact.whatsapp || "",
    email: contact.email || "",
    city: contact.city || "",
    state: contact.state || "",
    address: contact.address || "",
    cep: contact.cep || "",
    notes: contact.extra_contact || "",
    createdAt: contact.created_at,
    updatedAt: contact.updated_at,
  };
}

function buildClientPayload(body: any, companyId: string, branchId?: string | null) {
  const companyName = cleanText(body.companyName) || cleanText(body.name);
  const whatsapp = cleanText(body.whatsapp) || cleanText(body.phone);
  const phone = cleanText(body.phone) || whatsapp;

  return {
    company_id: companyId,
    branch_id: branchId || null,

    company_name: companyName,
    restaurant_name: companyName,

    responsible_name: cleanText(body.responsibleName),
    owner_name: cleanText(body.responsibleName),

    cnpj: cleanText(body.cnpj) || cleanText(body.document) || null,
    document: cleanText(body.cnpj) || cleanText(body.document) || null,

    whatsapp,
    phone,
    email: cleanText(body.email),

    address: cleanText(body.address),
    city: cleanText(body.city),
    state: cleanText(body.state),
    cep: cleanText(body.cep),

    extra_contact: cleanText(body.notes),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const search = cleanText(searchParams.get("search"));

    const clients = await prisma.company_contacts.findMany({
      where: {
        company_id: companyId,
        ...(search
          ? {
              OR: [
                { company_name: { contains: search, mode: "insensitive" } },
                { restaurant_name: { contains: search, mode: "insensitive" } },
                { responsible_name: { contains: search, mode: "insensitive" } },
                { owner_name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { whatsapp: { contains: onlyDigits(search) || search, mode: "insensitive" } },
                { phone: { contains: onlyDigits(search) || search, mode: "insensitive" } },
                { cnpj: { contains: onlyDigits(search) || search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ company_name: "asc" }, { created_at: "desc" }],
      take: 300,
    });

    return NextResponse.json({
      success: true,
      clients: clients.map(normalizeClient),
    });
  } catch (error: any) {
    console.error("GET /api/rh/clients:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao buscar clientes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const companyName = cleanText(body.companyName) || cleanText(body.name);

    if (!companyName) {
      return NextResponse.json(
        { error: "Nome da empresa é obrigatório." },
        { status: 400 }
      );
    }

    const payload = buildClientPayload(body, companyId, branchId);

    const client = await prisma.company_contacts.create({
      data: payload,
    });

    return NextResponse.json({
      success: true,
      client: normalizeClient(client),
    });
  } catch (error: any) {
    console.error("POST /api/rh/clients:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao cadastrar cliente" },
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

    const existingClient = await prisma.company_contacts.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existingClient) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    const payload = buildClientPayload(body, companyId, branchId || existingClient.branch_id);

    const updated = await prisma.company_contacts.updateMany({
      where: {
        id,
        company_id: companyId,
      },
      data: payload,
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Cliente não encontrado ou não pertence à empresa atual." },
        { status: 404 }
      );
    }

    const client = await prisma.company_contacts.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Cliente não encontrado após atualização." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      client: normalizeClient(client),
    });
  } catch (error: any) {
    console.error("PATCH /api/rh/clients:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar cliente" },
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

    const existingClient = await prisma.company_contacts.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existingClient) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    const deleted = await prisma.company_contacts.deleteMany({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (deleted.count !== 1) {
      return NextResponse.json(
        { error: "Cliente não encontrado ou não pertence à empresa atual." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/rh/clients:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao excluir cliente" },
      { status: 500 }
    );
  }
}
