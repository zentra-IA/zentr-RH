import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await Promise.resolve(context.params);
  const token = encodeURIComponent(decodeURIComponent(params.token));

  const manifest = {
    name: "Portal MOTIVAR RH",
    short_name: "MOTIVAR",
    description:
      "Vagas, processos seletivos, entrevistas e mensagens da MOTIVAR RH.",
    start_url: `/candidato/${token}`,
    scope: "/candidato/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1d4ed8",
    lang: "pt-BR",
    icons: [
      {
        src: "/candidato/motivar-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
