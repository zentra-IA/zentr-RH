import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

const BUCKET = "rh-documents";

const DEFAULT_DOCUMENTS = [
  { type: "rg_cnh", label: "RG ou CNH", required: true },
  { type: "cpf", label: "CPF", required: true },
  { type: "proof_address", label: "Comprovante de residência", required: true },
  { type: "work_card", label: "Carteira de trabalho", required: true },
  { type: "pis_pasep", label: "PIS/PASEP", required: true },
  { type: "bank_data", label: "Dados bancários", required: true },
  { type: "education", label: "Comprovante de escolaridade", required: false },
  { type: "medical_exam", label: "Atestado admissional", required: true },
  { type: "signed_contract", label: "Contrato assinado", required: true },
  { type: "photo", label: "Foto", required: false },
];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(url, key);
}

function clean(value: any) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeStatus(value: any) {
  const status = clean(value || "pending");

  if (["pending", "sent", "approved", "rejected", "expired"].includes(status)) {
    return status;
  }

  return "pending";
}

function safeName(name: string) {
  return String(name || "documento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

async function ensureBucket(supabase: any) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((bucket: any) => bucket.name === BUCKET);

  if (!exists) {
    await supabase.storage.createBucket(BUCKET, { public: false });
  }
}

async function createSignedUrl(supabase: any, storagePath: string | null) {
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    console.error("SIGNED URL ERROR:", error);
    return null;
  }

  return data?.signedUrl || null;
}

async function ensureDefaultDocuments({
  supabase,
  companyId,
  branchId,
  hiringId,
}: {
  supabase: any;
  companyId: string;
  branchId?: string | null;
  hiringId: string;
}) {
  const { data: existing, error } = await supabase
    .from("rh_hiring_documents")
    .select("id, document_type")
    .eq("company_id", companyId)
    .eq("hiring_id", hiringId);

  if (error) throw new Error(error.message);

  const existingTypes = new Set(
    (existing || []).map((item: any) => item.document_type)
  );

  const rows = DEFAULT_DOCUMENTS.filter((doc) => !existingTypes.has(doc.type)).map(
    (doc) => ({
      company_id: companyId,
      branch_id: branchId || null,
      hiring_id: hiringId,
      document_type: doc.type,
      document_label: doc.label,
      required: doc.required,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  );

  if (rows.length) {
    const { error: insertError } = await supabase
      .from("rh_hiring_documents")
      .insert(rows);

    if (insertError) throw new Error(insertError.message);
  }
}

async function uploadFile({
  supabase,
  companyId,
  hiringId,
  documentId,
  file,
}: {
  supabase: any;
  companyId: string;
  hiringId: string;
  documentId: string;
  file: File;
}) {
  const fileName = safeName(file.name || "documento");
  const fileType = file.type || "application/octet-stream";
  const fileSize = file.size;
  const storagePath = `${companyId}/${hiringId}/${documentId}/${Date.now()}-${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: fileType,
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const fileUrl = await createSignedUrl(supabase, storagePath);

  const { data, error } = await supabase
    .from("rh_hiring_document_files")
    .insert({
      company_id: companyId,
      hiring_id: hiringId,
      document_id: documentId,
      storage_path: storagePath,
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return {
    ...data,
    file_url: fileUrl,
  };
}

async function attachFilesToDocuments(supabase: any, documents: any[]) {
  const documentIds = documents.map((doc) => doc.id).filter(Boolean);

  if (!documentIds.length) return documents;

  const { data: files, error } = await supabase
    .from("rh_hiring_document_files")
    .select("*")
    .in("document_id", documentIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("FILES LOAD ERROR:", error);
    return documents;
  }

  const filesWithUrl = await Promise.all(
    (files || []).map(async (file: any) => ({
      ...file,
      file_url: file.storage_path
        ? await createSignedUrl(supabase, file.storage_path)
        : file.file_url || null,
    }))
  );

  const grouped: Record<string, any[]> = {};

  for (const file of filesWithUrl) {
    if (!grouped[file.document_id]) grouped[file.document_id] = [];
    grouped[file.document_id].push(file);
  }

  return documents.map((doc) => {
    const docFiles = grouped[doc.id] || [];

    return {
      ...doc,
      files: docFiles,
      file_url:
        docFiles[0]?.file_url ||
        doc.file_url ||
        null,
      file_name:
        docFiles[0]?.file_name ||
        doc.file_name ||
        null,
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const hiringId = clean(searchParams.get("hiringId"));

    if (!hiringId) {
      return NextResponse.json(
        { error: "hiringId obrigatório." },
        { status: 400 }
      );
    }

    await ensureDefaultDocuments({
      supabase,
      companyId,
      branchId,
      hiringId,
    });

    const { data, error } = await supabase
      .from("rh_hiring_documents")
      .select("*")
      .eq("company_id", companyId)
      .eq("hiring_id", hiringId)
      .order("required", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const today = new Date().toISOString().slice(0, 10);

    let documents = await Promise.all(
      (data || []).map(async (doc: any) => {
        const isLate =
          doc.status !== "approved" &&
          doc.due_date &&
          String(doc.due_date).slice(0, 10) < today;

        let fileUrl = doc.file_url || null;

        if (doc.storage_path) {
          fileUrl = await createSignedUrl(supabase, doc.storage_path);
        }

        return {
          ...doc,
          file_url: fileUrl,
          isLate,
          computedStatus: isLate ? "expired" : doc.status,
        };
      })
    );

    documents = await attachFilesToDocuments(supabase, documents);

    return NextResponse.json({
      success: true,
      documents,
    });
  } catch (error: any) {
    console.error("GET /api/rh/hirings/documents:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao carregar documentos." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = await requireCompany(req);

    await ensureBucket(supabase);

    const formData = await req.formData();

    const hiringId = clean(formData.get("hiringId"));
    const documentId = clean(formData.get("documentId"));
    const documentType = clean(formData.get("documentType"));
    const documentLabel = clean(formData.get("documentLabel"));
    const dueDate = clean(formData.get("dueDate")) || null;
    const notes = clean(formData.get("notes")) || null;
    const required = String(formData.get("required") || "true") !== "false";
    const files = formData.getAll("files").filter(Boolean) as File[];
    const singleFile = formData.get("file") as File | null;

    if (!hiringId) {
      return NextResponse.json(
        { error: "hiringId obrigatório." },
        { status: 400 }
      );
    }

    const finalFiles = [
      ...files,
      ...(singleFile && singleFile.size > 0 ? [singleFile] : []),
    ].filter((file) => file && file.size > 0);

    let finalDocumentId = documentId;
    let document: any = null;

    if (!finalDocumentId) {
      if (!documentType || !documentLabel) {
        return NextResponse.json(
          { error: "documentType e documentLabel são obrigatórios." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("rh_hiring_documents")
        .insert({
          company_id: companyId,
          branch_id: branchId || null,
          hiring_id: hiringId,
          document_type: documentType,
          document_label: documentLabel,
          required,
          due_date: dueDate,
          notes,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      document = data;
      finalDocumentId = data.id;
    }

    const update: any = {
      updated_at: new Date().toISOString(),
    };

    if (dueDate !== undefined) update.due_date = dueDate;
    if (notes !== undefined) update.notes = notes;

    const uploadedFiles: any[] = [];

    for (const file of finalFiles) {
      const uploaded = await uploadFile({
        supabase,
        companyId,
        hiringId,
        documentId: finalDocumentId,
        file,
      });

      uploadedFiles.push(uploaded);
    }

    if (uploadedFiles.length) {
      update.status = "sent";
      update.uploaded_at = new Date().toISOString();

      // Mantém compatibilidade com a tela antiga: salva o primeiro anexo também no documento.
      update.storage_path = uploadedFiles[0].storage_path;
      update.file_url = uploadedFiles[0].file_url;
      update.file_name = uploadedFiles[0].file_name;
      update.file_type = uploadedFiles[0].file_type;
      update.file_size = uploadedFiles[0].file_size;
    }

    const { data: updatedDoc, error: updateError } = await supabase
      .from("rh_hiring_documents")
      .update(update)
      .eq("id", finalDocumentId)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      success: true,
      document: {
        ...(updatedDoc || document),
        files: uploadedFiles,
      },
      files: uploadedFiles,
    });
  } catch (error: any) {
    console.error("POST /api/rh/hirings/documents:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao salvar documento." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);
    const body = await req.json();

    const id = clean(body.id);

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const status = normalizeStatus(body.status);

    const update: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (body.notes !== undefined) update.notes = clean(body.notes) || null;
    if (body.dueDate !== undefined) update.due_date = clean(body.dueDate) || null;
    if (body.rejectionReason !== undefined) {
      update.rejection_reason = clean(body.rejectionReason) || null;
    }

    if (status === "approved") {
      update.approved_at = new Date().toISOString();
      update.rejected_at = null;
    }

    if (status === "rejected") {
      update.rejected_at = new Date().toISOString();
      update.approved_at = null;
    }

    const { data, error } = await supabase
      .from("rh_hiring_documents")
      .update(update)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const freshUrl = data?.storage_path
      ? await createSignedUrl(supabase, data.storage_path)
      : data?.file_url || null;

    const [documentWithFiles] = await attachFilesToDocuments(supabase, [
      {
        ...data,
        file_url: freshUrl,
      },
    ]);

    return NextResponse.json({
      success: true,
      document: documentWithFiles,
    });
  } catch (error: any) {
    console.error("PATCH /api/rh/hirings/documents:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar documento." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const fileId = clean(searchParams.get("fileId"));

    if (!fileId) {
      return NextResponse.json({ error: "fileId obrigatório." }, { status: 400 });
    }

    const { data: file, error: findError } = await supabase
      .from("rh_hiring_document_files")
      .select("*")
      .eq("id", fileId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    if (!file) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }

    if (file.storage_path) {
      await supabase.storage.from(BUCKET).remove([file.storage_path]);
    }

    const { error } = await supabase
      .from("rh_hiring_document_files")
      .delete()
      .eq("id", fileId)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/rh/hirings/documents:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao excluir arquivo." },
      { status: 500 }
    );
  }
}
