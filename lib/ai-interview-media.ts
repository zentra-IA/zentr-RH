import "server-only";
import { randomUUID } from "node:crypto";

export const AI_MEDIA_BUCKET = "candidate-ai-interviews";

export type AiMediaKind = "resume" | "audio" | "video";

export const MAX_AI_MEDIA_BYTES: Record<AiMediaKind, number> = {
  resume: 10 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  video: 25 * 1024 * 1024,
};

const TYPES: Record<AiMediaKind, Set<string>> = {
  resume: new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  audio: new Set([
    "audio/webm", "audio/mp4", "audio/mpeg", "audio/wav",
    "audio/x-wav", "audio/ogg", "audio/aac", "audio/x-m4a",
  ]),
  video: new Set([
    "video/webm", "video/mp4", "video/quicktime",
  ]),
};

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "audio/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
  "audio/aac": "aac", "audio/x-m4a": "m4a",
  "video/webm": "webm", "video/mp4": "mp4", "video/quicktime": "mov",
};

export function normalizeMime(type: string, fileName = "") {
  let mime = String(type || "").split(";")[0].trim().toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    const extension = String(fileName).split(".").pop()?.toLowerCase() || "";
    const inferred: Record<string, string> = {
      pdf: "application/pdf", doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain", jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", webp: "image/webp",
      mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
      ogg: "audio/ogg", webm: "video/webm", mp4: "video/mp4", mov: "video/quicktime",
    };
    mime = inferred[extension] || mime;
  }
  return mime;
}

export function checkAiMedia(kind: AiMediaKind, mime: string, size: number) {
  if (!Number.isFinite(size) || size < 1 || size > MAX_AI_MEDIA_BYTES[kind]) {
    throw new Error(`Arquivo inválido ou acima do limite de ${Math.floor(MAX_AI_MEDIA_BYTES[kind] / 1048576)} MB.`);
  }
  if (!TYPES[kind].has(mime)) {
    throw new Error(`Formato ${mime || "desconhecido"} não permitido para ${kind}.`);
  }
}

function credentials() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !/^https:\/\//.test(url) || !key) {
    throw new Error("Configurar SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, key };
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function allowedPath(path: string) {
  if (!/^[a-zA-Z0-9_\-/\.]+$/.test(path) || path.includes("..") || path.startsWith("/")) {
    throw new Error("Caminho de mídia inválido.");
  }
  return path;
}

export function createAiMediaPath(companyId: string, sessionId: string, kind: AiMediaKind, mime: string) {
  return `${companyId}/${sessionId}/${kind}/${randomUUID()}.${EXT[mime] || "bin"}`;
}

export function assertSessionPath(path: string, companyId: string, sessionId: string, kind: AiMediaKind) {
  const prefix = `${companyId}/${sessionId}/${kind}/`;
  if (!path.startsWith(prefix) || !/^[a-zA-Z0-9_.-]+$/.test(path.slice(prefix.length))) {
    throw new Error("Arquivo não pertence a esta sessão.");
  }
  return allowedPath(path);
}

export async function signedAiMediaUpload(path: string) {
  const { url, key } = credentials();
  const api = `${url}/storage/v1/object/upload/sign/${AI_MEDIA_BUCKET}/${encodePath(allowedPath(path))}`;
  const res = await fetch(api, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ upsert: false }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Não foi possível autorizar upload (${res.status}): ${text.slice(0, 500)}`);
  const data = JSON.parse(text);
  if (data.token) {
    const endpoint = `${url}/storage/v1/object/upload/sign/${AI_MEDIA_BUCKET}/${encodePath(path)}`;
    return `${endpoint}?token=${encodeURIComponent(String(data.token))}`;
  }
  const raw = String(data.signedURL || data.signedUrl || data.url || "");
  if (!raw) throw new Error("O Storage não retornou link de upload.");
  if (raw.startsWith("http")) {
    if (!raw.startsWith(`${url}/storage/v1/`)) throw new Error("URL do Storage inválida.");
    return raw;
  }
  return `${url}/storage/v1/${raw.replace(/^\/+/, "")}`;
}

export async function downloadAiMedia(path: string) {
  const { url, key } = credentials();
  const endpoint = `${url}/storage/v1/object/authenticated/${AI_MEDIA_BUCKET}/${encodePath(allowedPath(path))}`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Arquivo indisponível no Storage (${response.status}): ${detail.slice(0, 100)}`);
  }
  return {
    bytes: await response.arrayBuffer(),
    mime: normalizeMime(response.headers.get("Content-Type") || ""),
    size: Number(response.headers.get("Content-Length") || 0),
  };
}

export async function storeAiMediaFallback(path: string, file: File) {
  const { url, key } = credentials();
  const endpoint = `${url}/storage/v1/object/${AI_MEDIA_BUCKET}/${encodePath(allowedPath(path))}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": normalizeMime(file.type, file.name),
      "x-upsert": "false",
    },
    body: file,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Erro ao guardar arquivo (${response.status}): ${detail.slice(0, 300)}`);
  }
}
