"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const MENU = [
  { label: "Painel", href: "/crm/dashboard", icon: "📊" },
  { label: "Vagas", href: "/crm/dashboard/jobs", icon: "💼" },
  { label: "Candidatos", href: "/crm/dashboard/candidates", icon: "👥" },
  { label: "Contatos", href: "/crm/dashboard/contacts", icon: "📒" },
  { label: "Inbox", href: "/crm/dashboard/inbox", icon: "💬" },
  { label: "Mensagens", href: "/crm/dashboard/messages", icon: "✉️" },
  { label: "Campanhas", href: "/crm/dashboard/campaigns", icon: "🚀" },
  { label: "Entrevistas", href: "/crm/dashboard/interviews", icon: "📅" },
  { label: "Contratações", href: "/crm/dashboard/hirings", icon: "📄" },
  { label: "BI", href: "/crm/dashboard/bi", icon: "📈" },
  { label: "Marketing IA", href: "/crm/dashboard/creative-generator", icon: "✨" },
  { label: "WhatsApp QR", href: "/crm/whatsapp", icon: "📲" },
];

function isActive(pathname: string, href: string) {
  if (href === "/crm/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function CrmDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <Link href="/crm/dashboard" style={styles.brand}>
          <div style={styles.logo}>Z</div>

          <div>
            <strong style={styles.brandTitle}>Zentra RH</strong>
            <span style={styles.brandSubtitle}>Recrutamento inteligente</span>
          </div>
        </Link>

        <nav style={styles.nav}>
          {MENU.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...styles.navItem,
                  ...(active ? styles.navItemActive : {}),
                }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={styles.footerCard}>
          <div style={styles.footerIcon}>🤖</div>
          <strong>RH com IA</strong>
          <p>
            Vagas, candidatos, WhatsApp, entrevistas e criativos em um só fluxo.
          </p>
        </div>
      </aside>

      <main style={styles.content}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    background: "linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe)",
    color: "#0f172a",
  },
  sidebar: {
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
    background: "rgba(255,255,255,.92)",
    borderRight: "1px solid #bfdbfe",
    padding: 18,
    boxShadow: "12px 0 40px rgba(37,99,235,.06)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 22,
    textDecoration: "none",
    color: "#0f172a",
    background: "linear-gradient(135deg, #ffffff, #eff6ff)",
    border: "1px solid #dbeafe",
    boxShadow: "0 12px 30px rgba(37,99,235,.10)",
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    fontWeight: 950,
    fontSize: 22,
    boxShadow: "0 14px 26px rgba(37,99,235,.25)",
  },
  brandTitle: {
    display: "block",
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: "-.02em",
  },
  brandSubtitle: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    marginTop: 2,
  },
  nav: {
    marginTop: 18,
    display: "grid",
    gap: 7,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 13px",
    borderRadius: 16,
    color: "#334155",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
    border: "1px solid transparent",
    transition: "all .15s ease",
  },
  navItemActive: {
    color: "#1d4ed8",
    background: "linear-gradient(135deg, #dbeafe, #eff6ff)",
    border: "1px solid #93c5fd",
    boxShadow: "0 10px 24px rgba(37,99,235,.10)",
  },
  navIcon: {
    width: 22,
    display: "inline-grid",
    placeItems: "center",
  },
  footerCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 22,
    background: "linear-gradient(135deg, #eff6ff, #ffffff)",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
  },
  footerIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    display: "grid",
    placeItems: "center",
    background: "#dbeafe",
    marginBottom: 8,
  },
  content: {
    minWidth: 0,
  },
};

