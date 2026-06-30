import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";

export async function getUserId(req?: NextRequest) {
  if (req) {
    return (
      req.cookies.get("zentra_user_id")?.value ||
      req.headers.get("x-user-id") ||
      null
    );
  }

  const cookieStore = await cookies();
  const headerStore = await headers();

  return (
    cookieStore.get("zentra_user_id")?.value ||
    headerStore.get("x-user-id") ||
    null
  );
}

export async function getCompanyId(req?: NextRequest) {
  if (req) {
    return (
      req.cookies.get("zentra_company_id")?.value ||
      req.headers.get("x-company-id") ||
      process.env.DEFAULT_COMPANY_ID ||
      null
    );
  }

  const cookieStore = await cookies();
  const headerStore = await headers();

  return (
    cookieStore.get("zentra_company_id")?.value ||
    headerStore.get("x-company-id") ||
    process.env.DEFAULT_COMPANY_ID ||
    null
  );
}

export async function getBranchId(req?: NextRequest) {
  if (req) {
    return (
      req.cookies.get("zentra_branch_id")?.value ||
      req.headers.get("x-branch-id") ||
      null
    );
  }

  const cookieStore = await cookies();
  const headerStore = await headers();

  return (
    cookieStore.get("zentra_branch_id")?.value ||
    headerStore.get("x-branch-id") ||
    null
  );
}

export async function requireCompany(req?: NextRequest) {
  const userId = await getUserId(req);
  const companyId = await getCompanyId(req);
  const branchId = await getBranchId(req);

  if (!companyId) {
    throw new Error("Empresa não identificada");
  }

  return {
    userId,
    companyId,
    branchId,
  };
}