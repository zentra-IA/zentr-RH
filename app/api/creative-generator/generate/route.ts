import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OPENAI_API_KEY =
  process.env.RH_OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_SUPPORT_KEY ||
  "";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

function clean(value: any) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function sizeByFormat(format: string) {
  // Tamanhos válidos para gpt-image-1:
  // quadrado: 1024x1024
  // vertical: 1024x1536
  // horizontal: 1536x1024
  if (format === "story") return "1024x1536";
  if (format === "wide") return "1536x1024";
  return "1024x1024";
}

function fallbackText(body: any) {
  const jobTitle = clean(body.jobTitle) || "Vaga disponível";
  const city = clean(body.city);
  const salary = clean(body.salary);
  const benefits = clean(body.benefits);
  const requirements = clean(body.requirements);
  const whatsapp = clean(body.recruiterWhatsapp);

  return {
    statusText: `🚀 Estamos contratando!

${jobTitle}${city ? `\n📍 ${city}` : ""}${salary ? `\n💰 ${salary}` : ""}

${benefits ? `Benefícios:\n${benefits}` : ""}

${requirements ? `\nRequisitos:\n${requirements}` : ""}

${whatsapp ? `\nEnvie seu currículo: ${whatsapp}` : "Envie seu currículo e participe do processo seletivo."}`,
    instagramCaption: `🚀 Oportunidade de emprego

Estamos com vaga aberta para ${jobTitle}.${city ? `\n\n📍 Local: ${city}` : ""}${salary ? `\n💰 Salário: ${salary}` : ""}

${benefits ? `\nBenefícios:\n${benefits}` : ""}

${requirements ? `\nRequisitos:\n${requirements}` : ""}

${whatsapp ? `\n📲 Envie seu currículo pelo WhatsApp: ${whatsapp}` : "\nCandidate-se agora."}`,
    whatsappText: `Olá! Estamos com vaga aberta para ${jobTitle}.${city ? `\nLocal: ${city}` : ""}${salary ? `\nSalário: ${salary}` : ""}

${benefits ? `Benefícios: ${benefits}` : ""}

${whatsapp ? `Envie seu currículo para: ${whatsapp}` : "Tem interesse? Responda esta mensagem."}`,
    hashtags:
      "#emprego #vaga #recrutamento #rh #trabalho #oportunidade #curriculo #contratacao",
  };
}

async function generateTexts(body: any) {
  if (!OPENAI_API_KEY) return fallbackText(body);

  const prompt = `
Você é um especialista em RH, recrutamento e marketing de vagas.

Crie textos profissionais para divulgar uma oportunidade de emprego.

Contexto:
Tipo de criativo: ${clean(body.creativeType)}
Estilo: ${clean(body.style)}
Formato: ${clean(body.format)}
Vaga: ${clean(body.jobTitle)}
Cidade/região: ${clean(body.city)}
Salário: ${clean(body.salary)}
Benefícios: ${clean(body.benefits)}
Requisitos: ${clean(body.requirements)}
Empresa: ${clean(body.companyName)}
WhatsApp: ${clean(body.recruiterWhatsapp)}
Extras: ${clean(body.extra)}

Retorne SOMENTE JSON válido:
{
  "statusText": "texto curto para WhatsApp Status",
  "instagramCaption": "legenda completa para Instagram/Facebook",
  "whatsappText": "mensagem curta para envio direto no WhatsApp",
  "hashtags": "hashtags relevantes"
}
  `.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "Você cria campanhas de recrutamento em português do Brasil. Responda apenas JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("OPENAI TEXT ERROR:", JSON.stringify(data, null, 2));
    return fallbackText(body);
  }

  const content = data?.choices?.[0]?.message?.content || "";

  try {
    return JSON.parse(content);
  } catch {
    return fallbackText(body);
  }
}

async function generateImage(body: any) {
  if (!OPENAI_API_KEY) {
    return {
      imageUrl: null,
      imageError: "OPENAI_API_KEY/RH_OPENAI_API_KEY ausente.",
    };
  }

  const jobTitle = clean(body.jobTitle) || "Vaga de Emprego";
  const city = clean(body.city);
  const salary = clean(body.salary);
  const benefits = clean(body.benefits);
  const companyName = clean(body.companyName);
  const creativeType = clean(body.creativeType) || "Vaga de Emprego";
  const style = clean(body.style) || "Moderno";
  const format = clean(body.format) || "feed";

  const imagePrompt = `
Crie uma arte visual profissional para recrutamento e RH.

IMPORTANTE:
- Gere uma imagem final pronta para anúncio de vaga.
- Tema: ${creativeType}
- Estilo visual: ${style}
- Vaga principal: ${jobTitle}
${city ? `- Cidade/região: ${city}` : ""}
${salary ? `- Salário: ${salary}` : ""}
${benefits ? `- Benefícios: ${benefits}` : ""}
${companyName ? `- Empresa: ${companyName}` : ""}

Direção de arte:
- visual branco e azul, moderno, corporativo e premium
- destaque visual para contratação e oportunidade de emprego
- pessoas profissionais, escritório, atendimento, entrevista ou equipe de trabalho
- layout limpo para rede social
- aparência de anúncio de vaga profissional
- NÃO criar arte de comida, restaurante, delivery ou promoção de alimento
- NÃO usar logos ou marcas registradas
- NÃO colocar textos pequenos demais
- incluir composição com área de destaque para título da vaga
  `.trim();

  const bodyPayload: any = {
    model: IMAGE_MODEL,
    prompt: imagePrompt,
    size: sizeByFormat(format),
    n: 1,
  };

  // gpt-image-1 aceita quality. Se trocar para dall-e-3 e der erro, remova quality.
  if (IMAGE_MODEL.startsWith("gpt-image")) {
    bodyPayload.quality = "medium";
    bodyPayload.output_format = "png";
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("OPENAI IMAGE ERROR:", JSON.stringify(data, null, 2));

    return {
      imageUrl: null,
      imageError:
        data?.error?.message ||
        "Erro ao gerar imagem. Verifique modelo, crédito, billing e permissões da chave.",
    };
  }

  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;

  if (b64) {
    return {
      imageUrl: `data:image/png;base64,${b64}`,
      imageError: null,
    };
  }

  if (url) {
    return {
      imageUrl: url,
      imageError: null,
    };
  }

  return {
    imageUrl: null,
    imageError: "A OpenAI respondeu, mas não retornou b64_json nem url.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const [texts, image] = await Promise.all([
      generateTexts(body),
      generateImage(body),
    ]);

    return NextResponse.json({
      success: true,
      ...texts,
      imageUrl: image.imageUrl,
      imageError: image.imageError,
      imageModel: IMAGE_MODEL,
      imageSize: sizeByFormat(clean(body.format)),
    });
  } catch (error: any) {
    console.error("POST /api/creative-generator/generate:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao gerar criativo RH.",
      },
      { status: 500 }
    );
  }
}
