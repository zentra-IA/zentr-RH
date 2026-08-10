import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase não configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "pdf",
  "mp3",
  "ogg",
  "oga",
  "wav",
  "m4a",
  "aac",
  "mp4",
];

function safeExtension(fileName: string) {
  const ext =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase() || "bin";

  return ALLOWED_EXTENSIONS.includes(ext)
    ? ext
    : "bin";
}

function detectMediaType(
  file: File,
  ext: string
) {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (
    file.type === "application/pdf" ||
    ext === "pdf"
  ) {
    return "pdf";
  }

  return "file";
}

function maxSizeByType(
  mediaType: string
) {
  if (mediaType === "image") {
    return 10 * 1024 * 1024;
  }

  if (mediaType === "audio") {
    return 25 * 1024 * 1024;
  }

  if (mediaType === "pdf") {
    return 25 * 1024 * 1024;
  }

  if (mediaType === "video") {
    return 50 * 1024 * 1024;
  }

  return 15 * 1024 * 1024;
}

async function ensureCandidateAttachmentsBucket(
  supabase: ReturnType<typeof getSupabase>
) {
  const bucketName =
    "candidate-attachments";

  const { data: existing, error: findError } =
    await supabase.storage.getBucket(
      bucketName
    );

  if (existing?.id) {
    // Como o link é enviado ao cliente externo,
    // esse bucket precisa fornecer URL pública.
    if (existing.public !== true) {
      const { error: updateError } =
        await supabase.storage.updateBucket(
          bucketName,
          {
            public: true,
          }
        );

      if (updateError) {
        throw new Error(
          `Não foi possível tornar o bucket ${bucketName} público: ${updateError.message}`
        );
      }
    }

    return bucketName;
  }

  // "Bucket not found" é esperado na primeira execução.
  if (
    findError &&
    !String(findError.message || "")
      .toLowerCase()
      .includes("not found")
  ) {
    console.warn(
      "[UPLOAD] getBucket:",
      findError
    );
  }

  const { error: createError } =
    await supabase.storage.createBucket(
      bucketName,
      {
        public: true,
      }
    );

  if (
    createError &&
    !String(createError.message || "")
      .toLowerCase()
      .includes("already exists")
  ) {
    throw new Error(
      `Não foi possível criar o bucket ${bucketName}: ${createError.message}`
    );
  }

  return bucketName;
}

export async function POST(
  req: NextRequest
) {
  try {
    const supabase =
      getSupabase();

    const formData =
      await req.formData();

    const file =
      formData.get("file") as File | null;

    const folder = String(
      formData.get("folder") ||
        "uploads"
    )
      .replace(
        /[^a-zA-Z0-9-_]/g,
        ""
      )
      .slice(0, 40);

    if (!file) {
      return NextResponse.json(
        {
          error:
            "Arquivo não enviado.",
        },
        { status: 400 }
      );
    }

    const ext =
      safeExtension(file.name);

    const mediaType =
      detectMediaType(file, ext);

    const maxSize =
      maxSizeByType(mediaType);

    if (
      file.size >
      maxSize
    ) {
      return NextResponse.json(
        {
          error:
            `Arquivo muito grande. Limite para ${mediaType}: ${Math.round(
              maxSize /
                1024 /
                1024
            )}MB.`,
        },
        { status: 400 }
      );
    }

    if (ext === "bin") {
      return NextResponse.json(
        {
          error:
            "Tipo de arquivo não permitido.",
        },
        { status: 400 }
      );
    }

    const isCandidateAttachment =
      folder ===
        "interview-client-files" ||
      folder.startsWith(
        "interview-client"
      );

    // Preserva o comportamento antigo para todos os outros uploads.
    const bucketName =
      isCandidateAttachment
        ? await ensureCandidateAttachmentsBucket(
            supabase
          )
        : "products";

    const fileName =
      `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const filePath =
      `${folder}/${mediaType}/${fileName}`;

    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    const {
      error: uploadError,
    } =
      await supabase.storage
        .from(bucketName)
        .upload(
          filePath,
          buffer,
          {
            contentType:
              file.type ||
              "application/octet-stream",
            upsert: true,
          }
        );

    if (uploadError) {
      throw new Error(
        `Falha no Storage (${bucketName}): ${uploadError.message}`
      );
    }

    const { data } =
      supabase.storage
        .from(bucketName)
        .getPublicUrl(
          filePath
        );

    if (!data?.publicUrl) {
      throw new Error(
        "O upload foi concluído, mas o Supabase não retornou URL pública."
      );
    }

    return NextResponse.json(
      {
        success: true,
        url: data.publicUrl,
        fileUrl: data.publicUrl,
        imageUrl: data.publicUrl,
        mediaUrl: data.publicUrl,
        mediaType,
        mimeType:
          file.type || null,
        path: filePath,
        bucket: bucketName,
        name: file.name,
        size: file.size,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(
      "POST /api/upload:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro ao fazer upload do arquivo",
        details:
          error?.message ||
          String(error),
      },
      { status: 500 }
    );
  }
}
