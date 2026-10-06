const MEDIA_BUCKET = "candidate-portal-media";
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export const CANDIDATE_MEDIA_BUCKET = MEDIA_BUCKET;
export const CANDIDATE_MEDIA_MAX_BYTES = MAX_MEDIA_BYTES;

export const CANDIDATE_MEDIA_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function storageConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Storage não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRole,
  };
}

export function sanitizeCandidateMediaName(name: string) {
  const parts = String(name || "imagem").split(".");
  const extension =
    parts.length > 1
      ? `.${parts.pop()!.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`
      : "";

  const base = parts
    .join(".")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);

  return `${base || "imagem"}${extension}`;
}

export async function uploadCandidateMedia(options: {
  path: string;
  mimeType: string;
  bytes: ArrayBuffer;
}) {
  const { url, serviceRole } = storageConfig();

  const response = await fetch(
    `${url}/storage/v1/object/${MEDIA_BUCKET}/${options.path}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": options.mimeType,
        "x-upsert": "false",
      },
      body: Buffer.from(options.bytes),
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Não foi possível salvar a imagem da publicação. ${message}`.trim()
    );
  }
}

export async function readCandidateMedia(path: string) {
  const { url, serviceRole } = storageConfig();

  return fetch(
    `${url}/storage/v1/object/authenticated/${MEDIA_BUCKET}/${path}`,
    {
      method: "GET",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
      cache: "no-store",
    }
  );
}

export async function deleteCandidateMedia(path: string) {
  const { url, serviceRole } = storageConfig();

  const response = await fetch(
    `${url}/storage/v1/object/${MEDIA_BUCKET}/${path}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Não foi possível remover a imagem da publicação. ${message}`.trim()
    );
  }
}
