"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Company = {
  id: string;
  name: string;
  slug: string;
  role?: string;
};

export default function SelecionarEmpresaPage() {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: companyUsers } = await supabase
        .from("company_users")
        .select("company_id, role")
        .eq("user_id", user.id);

      if (!companyUsers || companyUsers.length === 0) {
        setLoading(false);
        return;
      }

      const companyIds = companyUsers.map((item) => item.company_id);

      const { data: companiesData } = await supabase
        .from("companies")
        .select("id, name, slug")
        .in("id", companyIds);

      const result =
        companiesData?.map((company) => {
          const link = companyUsers.find(
            (item) => item.company_id === company.id
          );

          return {
            ...company,
            role: link?.role || "atendente",
          };
        }) || [];

      setCompanies(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function selectCompany(company: Company) {
    localStorage.setItem("active_company_id", company.id);
    localStorage.setItem("active_company_slug", company.slug);
    localStorage.setItem("active_company_role", company.role || "atendente");

    router.push("/crm/dashboard");
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}>M</div>

        <p style={styles.brand}>Motivar RH</p>

        <h1 style={styles.title}>Escolha sua empresa</h1>

        <p style={styles.subtitle}>
          Selecione a empresa para acessar o ambiente de recrutamento.
        </p>

        {loading && <p style={styles.text}>Carregando empresas...</p>}

        {!loading && companies.length === 0 && (
          <p style={styles.text}>Nenhuma empresa vinculada ao seu usuário.</p>
        )}

        <div style={styles.list}>
          {companies.map((company) => (
            <button
              key={company.id}
              style={styles.button}
              onClick={() => selectCompany(company)}
            >
              <span>{company.name}</span>
              <small style={styles.role}>{company.role}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #dbeafe 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 32,
    boxShadow: "0 24px 70px rgba(37, 99, 235, 0.14)",
    textAlign: "center",
  },
  logo: {
    width: 68,
    height: 68,
    margin: "0 auto 18px",
    borderRadius: 22,
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    fontWeight: 900,
  },
  brand: {
    margin: 0,
    color: "#2563eb",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
  },
  title: {
    margin: "10px 0 8px",
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 900,
  },
  subtitle: {
    margin: "0 0 24px",
    color: "#64748b",
    fontSize: 15,
  },
  text: {
    color: "#64748b",
    fontSize: 14,
  },
  list: {
    display: "grid",
    gap: 12,
  },
  button: {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 18,
    border: "1px solid #bfdbfe",
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  role: {
    color: "#2563eb",
    fontWeight: 800,
    textTransform: "capitalize",
  },
};