"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "Erro ao entrar");
        return;
      }

      router.push("/crm/dashboard");
    } catch {
      alert("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}>M</div>

        <p style={styles.brand}>Motivar RH</p>

        <h1 style={styles.title}>Entrar no painel</h1>

        <p style={styles.subtitle}>
          Plataforma inteligente para recrutamento, seleção e gestão de candidatos.
        </p>

        <form onSubmit={handleLogin} style={styles.form}>
          <label style={styles.label}>
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@email.com"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Senha
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              style={styles.input}
            />
          </label>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p style={styles.helpText}>
  Acesso criado pelo administrador da plataforma.
</p>
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
    maxWidth: 440,
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
    boxShadow: "0 14px 30px rgba(37, 99, 235, 0.25)",
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
    fontSize: 32,
    fontWeight: 900,
  },
  subtitle: {
    margin: "0 0 28px",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.5,
  },
  form: {
    display: "grid",
    gap: 16,
    textAlign: "left",
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
    display: "grid",
    gap: 8,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    borderRadius: 16,
    padding: "15px 16px",
    fontSize: 15,
    outline: "none",
  },
helpText: {
  marginTop: 22,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 600,
},
  button: {
    marginTop: 8,
    width: "100%",
    border: 0,
    borderRadius: 16,
    padding: "16px 18px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(37, 99, 235, 0.24)",
  },
  link: {
    display: "inline-block",
    marginTop: 22,
    color: "#2563eb",
    fontSize: 14,
    fontWeight: 800,
    textDecoration: "none",
  },
};