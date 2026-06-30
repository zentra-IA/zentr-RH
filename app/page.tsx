import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zentra RH",
  description: "Plataforma inteligente de recrutamento e seleção",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}