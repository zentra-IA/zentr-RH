import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "").trim();
    const companyName = String(body?.companyName || "Zentra RH").trim();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, e-mail e senha são obrigatórios" },
        { status: 400 }
      );
    }

    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message || "Erro ao criar usuário" },
        { status: 400 }
      );
    }

    const slug = `${slugify(companyName)}-${Date.now()}`;

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        slug,
        active: true,
      })
      .select("id, name, slug")
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: companyError?.message || "Erro ao criar empresa" },
        { status: 400 }
      );
    }

    const { data: branch } = await supabase
      .from("branches")
      .insert({
        company_id: company.id,
        name: "Matriz",
        slug: "matriz",
        active: true,
      })
      .select("id")
      .single();

    const { error: linkError } = await supabase
      .from("company_users")
      .insert({
        company_id: company.id,
        user_id: userData.user.id,
        role: "admin",
      });

    if (linkError) {
      return NextResponse.json(
        { error: linkError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: userData.user.id,
      company_id: company.id,
      branch_id: branch?.id || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao cadastrar" },
      { status: 500 }
    );
  }
}