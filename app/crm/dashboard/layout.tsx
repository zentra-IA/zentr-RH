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
    <div className="crm-shell">
      <aside className="crm-sidebar">
        <Link href="/crm/dashboard" className="crm-brand">
          <div className="crm-logo">Z</div>
          <div>
            <strong>Zentra RH</strong>
            <span>Recrutamento inteligente</span>
          </div>
        </Link>

        <nav className="crm-nav">
          {MENU.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`crm-nav-item ${active ? "active" : ""}`}
              >
                <span>{item.icon}</span>
                <b>{item.label}</b>
              </Link>
            );
          })}
        </nav>

        <div className="crm-footer-card">
          <div>🤖</div>
          <strong>RH com IA</strong>
          <p>Vagas, candidatos, WhatsApp, entrevistas e criativos em um só fluxo.</p>
        </div>
      </aside>

      <main className="crm-content">{children}</main>

      <style jsx global>{`
        .crm-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 260px 1fr;
          background: linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe);
          color: #0f172a;
        }

        .crm-sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          background: rgba(255, 255, 255, 0.92);
          border-right: 1px solid #bfdbfe;
          padding: 18px;
          box-shadow: 12px 0 40px rgba(37, 99, 235, 0.06);
          z-index: 20;
        }

        .crm-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 22px;
          text-decoration: none;
          color: #0f172a;
          background: linear-gradient(135deg, #ffffff, #eff6ff);
          border: 1px solid #dbeafe;
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.1);
        }

        .crm-logo {
          width: 46px;
          height: 46px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #38bdf8, #2563eb);
          color: #fff;
          font-weight: 950;
          font-size: 22px;
        }

        .crm-brand strong {
          display: block;
          font-size: 16px;
          font-weight: 950;
        }

        .crm-brand span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          margin-top: 2px;
        }

        .crm-nav {
          margin-top: 18px;
          display: grid;
          gap: 7px;
        }

        .crm-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 13px;
          border-radius: 16px;
          color: #334155;
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .crm-nav-item.active {
          color: #1d4ed8;
          background: linear-gradient(135deg, #dbeafe, #eff6ff);
          border-color: #93c5fd;
        }

        .crm-footer-card {
          margin-top: 18px;
          padding: 14px;
          border-radius: 22px;
          background: linear-gradient(135deg, #eff6ff, #ffffff);
          border: 1px solid #bfdbfe;
          color: #1e3a8a;
        }

        .crm-content {
          min-width: 0;
          overflow-x: auto;
        }

        @media (max-width: 768px) {
          .crm-shell {
            display: block;
          }

          .crm-sidebar {
            position: sticky;
            top: 0;
            height: auto;
            padding: 10px;
            border-right: 0;
            border-bottom: 1px solid #bfdbfe;
            overflow-x: auto;
            overflow-y: hidden;
          }

          .crm-brand {
            margin-bottom: 10px;
          }

          .crm-nav {
            display: flex;
            gap: 8px;
            margin-top: 0;
            overflow-x: auto;
            padding-bottom: 6px;
          }

          .crm-nav-item {
            flex: 0 0 auto;
            padding: 10px 12px;
            font-size: 12px;
            border-radius: 999px;
            background: #fff;
            border: 1px solid #dbeafe;
          }

          .crm-footer-card {
            display: none;
          }

          .crm-content {
            width: 100%;
            padding: 0;
            overflow-x: auto;
          }

          table,
          .table,
          [role="table"] {
            min-width: 760px;
          }

          input,
          select,
          textarea,
          button {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}