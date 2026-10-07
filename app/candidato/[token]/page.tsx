import type { Metadata } from "next";
import CandidatePortalApp from "@/components/candidate-portal/CandidatePortalApp";
import "./portal.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  context: { params: { token: string } | Promise<{ token: string }> }
): Promise<Metadata> {
  const params = await Promise.resolve(context.params);
  const token = encodeURIComponent(decodeURIComponent(params.token));

  const logoPath =
    process.env.NEXT_PUBLIC_MOTIVAR_LOGO_PATH ||
    "/motivar-logo.png";

  return {
    title: "Portal do Candidato | MOTIVAR RH",
    description:
      "Acompanhe vagas, processos seletivos e entrevistas da MOTIVAR RH.",
    manifest: `/api/candidate-portal/${token}/manifest`,
    icons: {
      icon: logoPath,
      apple: logoPath,
    },
    themeColor: "#1d4ed8",
    appleWebApp: {
      capable: true,
      title: "MOTIVAR",
      statusBarStyle: "default",
    },
  };
}

export default async function CandidatePortalPage(
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await Promise.resolve(context.params);

  return (
    <CandidatePortalApp
      portalToken={decodeURIComponent(params.token)}
    />
  );
}
