"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import FloatingTaskCenter from "@/components/tasks/FloatingTaskCenter";
import FloatingInternalChat from "@/components/chat/FloatingInternalChat";

const MENU = [
  { label: "Clientes", href: "/crm/dashboard/clients", icon: "🏢" },
  { label: "Vagas", href: "/crm/dashboard/jobs", icon: "💼" },
  { label: "Candidatos", href: "/crm/dashboard/candidates", icon: "👥" },
  { label: "Disparar contatos", href: "/crm/dashboard/contacts", icon: "📒" },
  { label: "Painel", href: "/crm/dashboard", icon: "📊" },
  { label: "Inbox", href: "/crm/dashboard/inbox", icon: "💬" },
  { label: "Entrevista", href: "/crm/dashboard/interviews", icon: "📅" },
  {
    label: "Candidatos enviados a clientes",
    href: "/crm/dashboard/candidate-presentations",
    icon: "📤",
  },
  { label: "Contratação", href: "/crm/dashboard/hirings", icon: "📄" },
  { label: "Tarefas", href: "/crm/dashboard/tasks", icon: "📋" },
  { label: "BI", href: "/crm/dashboard/bi", icon: "📈" },
  { label: "Marketing IA", href: "/crm/dashboard/creative-generator", icon: "✨" },
  { label: "Criar mensagens", href: "/crm/dashboard/messages", icon: "✉️" },
  { label: "WhatsApp QR", href: "/crm/whatsapp", icon: "📲" },
];

function isActive(pathname: string, href: string) {
  if (href === "/crm/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function CrmDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`crm-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="crm-sidebar">
        <div className="crm-sidebar-top">
          <Link href="/crm/dashboard" className="crm-brand" title="Zentra RH">
            <div className="crm-logo">Z</div>
            <div className="crm-brand-text">
              <strong>Zentra RH</strong>
              <span>Recrutamento inteligente</span>
            </div>
          </Link>

          <button
            type="button"
            className="crm-collapse-btn"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <nav className="crm-nav">
          {MENU.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`crm-nav-item ${active ? "active" : ""}`}
              >
                <span className="crm-nav-icon">{item.icon}</span>
                <b className="crm-nav-label">{item.label}</b>
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

      <FloatingTaskCenter />
      <FloatingInternalChat />

      <style jsx global>{`
        .crm-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px 1fr;
          background: linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe);
          color: #0f172a;
          transition: grid-template-columns 0.2s ease;
        }

        .crm-shell.sidebar-collapsed {
          grid-template-columns: 86px 1fr;
        }

        .crm-sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          background: rgba(255, 255, 255, 0.94);
          border-right: 1px solid #bfdbfe;
          padding: 14px;
          box-shadow: 12px 0 40px rgba(37, 99, 235, 0.06);
          z-index: 20;
        }

        .crm-sidebar-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .crm-brand {
          flex: 1;
          min-width: 0;
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
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
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

        .crm-collapse-btn {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          border: 1px solid #bfdbfe;
          border-radius: 14px;
          background: #ffffff;
          color: #1d4ed8;
          font-size: 22px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 8px 22px rgba(37, 99, 235, 0.08);
        }

        .crm-collapse-btn:hover {
          background: #eff6ff;
        }

        .crm-nav {
          margin-top: 16px;
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

        .crm-nav-icon {
          width: 22px;
          flex: 0 0 22px;
          display: grid;
          place-items: center;
        }

        .crm-nav-item:hover {
          background: #f8fafc;
          border-color: #dbeafe;
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

        .crm-footer-card strong {
          display: block;
          margin-top: 8px;
        }

        .crm-footer-card p {
          margin: 6px 0 0;
          color: #475569;
          font-size: 12px;
          line-height: 1.4;
          font-weight: 700;
        }

        .crm-content {
          min-width: 0;
          overflow-x: auto;
        }

        .crm-shell.sidebar-collapsed .crm-sidebar {
          padding: 12px;
        }

        .crm-shell.sidebar-collapsed .crm-sidebar-top {
          justify-content: center;
          flex-direction: column;
        }

        .crm-shell.sidebar-collapsed .crm-brand {
          width: 58px;
          height: 58px;
          padding: 7px;
          justify-content: center;
        }

        .crm-shell.sidebar-collapsed .crm-brand-text,
        .crm-shell.sidebar-collapsed .crm-nav-label,
        .crm-shell.sidebar-collapsed .crm-footer-card {
          display: none;
        }

        .crm-shell.sidebar-collapsed .crm-nav-item {
          justify-content: center;
          padding: 12px;
        }

        .crm-shell.sidebar-collapsed .crm-nav-icon {
          font-size: 18px;
        }

        @media (max-width: 768px) {
          .crm-shell,
          .crm-shell.sidebar-collapsed {
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

          .crm-sidebar-top {
            min-width: max-content;
          }

          .crm-brand {
            max-width: 235px;
            margin-bottom: 10px;
          }

          .crm-collapse-btn {
            display: none;
          }

          .crm-nav {
            display: flex;
            gap: 8px;
            margin-top: 0;
            overflow-x: auto;
            padding-bottom: 6px;
            -webkit-overflow-scrolling: touch;
          }

          .crm-nav-item {
            flex: 0 0 auto;
            padding: 10px 12px;
            font-size: 12px;
            border-radius: 999px;
            background: #fff;
            border: 1px solid #dbeafe;
          }

          .crm-nav-icon {
            width: auto;
            flex: 0 0 auto;
          }

          .crm-footer-card {
            display: none;
          }

          .crm-shell.sidebar-collapsed .crm-brand-text,
          .crm-shell.sidebar-collapsed .crm-nav-label {
            display: initial;
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
