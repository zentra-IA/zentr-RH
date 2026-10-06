import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export function cleanPortalText(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeCpf(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  return digits || null;
}

export function formatCpf(value: unknown) {
  const digits = normalizeCpf(value) || "";
  if (digits.length !== 11) return digits;
  return digits.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4"
  );
}

export function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function normalizeEmail(value: unknown) {
  const email = cleanPortalText(value, 320).toLowerCase();
  return email || null;
}

function secret() {
  const value =
    process.env.CANDIDATE_PORTAL_SECRET ||
    process.env.VAPID_PRIVATE_KEY;

  if (!value) {
    throw new Error(
      "Configure CANDIDATE_PORTAL_SECRET (recomendado) ou VAPID_PRIVATE_KEY."
    );
  }

  return value;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string) {
  return crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
}

export function signCandidatePortalToken(
  profileId: string,
  companyId: string,
  version: number
) {
  const payload = encode(
    JSON.stringify({
      p: profileId,
      c: companyId,
      v: version,
      k: "candidate_portal",
    })
  );

  return `${payload}.${signature(payload)}`;
}

export function parseCandidatePortalToken(token: string) {
  const [payload, suppliedSignature] = String(token || "").split(".");

  if (!payload || !suppliedSignature) {
    throw new Error("PORTAL_TOKEN_INVALID");
  }

  const expected = signature(payload);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw new Error("PORTAL_TOKEN_INVALID");
  }

  const data = JSON.parse(decode(payload));

  if (
    data?.k !== "candidate_portal" ||
    !data?.p ||
    !data?.c ||
    !Number.isInteger(Number(data?.v))
  ) {
    throw new Error("PORTAL_TOKEN_INVALID");
  }

  return {
    profileId: String(data.p),
    companyId: String(data.c),
    version: Number(data.v),
  };
}

export async function resolveCandidatePortalToken(token: string) {
  const parsed = parseCandidatePortalToken(token);

  const rows = await prisma.$queryRaw<any[]>`
    SELECT *
    FROM "candidate_portal_profiles"
    WHERE "id" = ${parsed.profileId}::uuid
      AND "company_id" = ${parsed.companyId}::uuid
      AND "token_version" = ${parsed.version}
      AND "access_active" = true
      AND (
        "access_expires_at" IS NULL
        OR "access_expires_at" > now()
      )
    LIMIT 1
  `;

  const profile = rows[0];

  if (!profile) {
    throw new Error("PORTAL_ACCESS_NOT_FOUND");
  }

  return profile;
}

export function buildCandidatePortalUrl(
  origin: string,
  profile: {
    id: string;
    company_id: string;
    token_version: number;
  }
) {
  const configured = cleanPortalText(process.env.NEXT_PUBLIC_APP_URL, 500);
  const base = (configured || origin).replace(/\/$/, "");
  const token = signCandidatePortalToken(
    profile.id,
    profile.company_id,
    Number(profile.token_version || 1)
  );

  return `${base}/candidato/${encodeURIComponent(token)}`;
}

export function candidateVisibleCompanyIds(companyId: string) {
  const publicApply = cleanPortalText(
    process.env.PUBLIC_APPLY_COMPANY_ID,
    100
  );

  return Array.from(
    new Set([companyId, publicApply].filter(Boolean))
  );
}

export async function findCandidateByIdentity(
  companyId: string,
  input: {
    candidateId?: string | null;
    cpf?: string | null;
    phone?: string | null;
    email?: string | null;
  }
) {
  const companyIds = candidateVisibleCompanyIds(companyId);

  if (input.candidateId) {
    const candidate = await prisma.candidateProfile.findFirst({
      where: {
        id: input.candidateId,
        company_id: { in: companyIds },
        active: true,
      },
    });

    if (candidate) {
      return {
        status: "MATCHED",
        method: "CANDIDATE_ID",
        confidence: 100,
        candidate,
      };
    }
  }

  const cpf = normalizeCpf(input.cpf);

  if (cpf) {
    const formatted = formatCpf(cpf);

    const matches = await prisma.candidateProfile.findMany({
      where: {
        company_id: { in: companyIds },
        active: true,
        cpf: {
          in: Array.from(new Set([cpf, formatted].filter(Boolean))),
        },
      },
      take: 3,
    });

    if (matches.length === 1) {
      return {
        status: "MATCHED",
        method: "CPF",
        confidence: 100,
        candidate: matches[0],
      };
    }

    if (matches.length > 1) {
      return {
        status: "REVIEW",
        method: "CPF_DUPLICATE",
        confidence: 70,
        candidate: null,
      };
    }
  }

  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  if (email || phone) {
    const matches = await prisma.candidateProfile.findMany({
      where: {
        company_id: { in: companyIds },
        active: true,
        OR: [
          ...(email
            ? [
                {
                  email: {
                    equals: email,
                    mode: "insensitive" as const,
                  },
                },
              ]
            : []),
          ...(phone
            ? [
                { phone: { in: [phone, phone.replace(/^55/, "")] } },
                { mobile: { in: [phone, phone.replace(/^55/, "")] } },
              ]
            : []),
        ],
      },
      take: 5,
    });

    const exact = matches.filter((candidate) => {
      const candidateEmail = normalizeEmail(candidate.email);
      const candidatePhone =
        normalizePhone(candidate.mobile) ||
        normalizePhone(candidate.phone);

      const emailOk = email ? candidateEmail === email : true;
      const phoneOk = phone ? candidatePhone === phone : true;

      return emailOk && phoneOk;
    });

    if (exact.length === 1 && email && phone) {
      return {
        status: "REVIEW",
        method: "EMAIL_PHONE",
        confidence: 90,
        candidate: exact[0],
      };
    }
  }

  return {
    status: "UNLINKED",
    method: null,
    confidence: 0,
    candidate: null,
  };
}
