import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCommandCenterContext } from "@/lib/command-center-auth";

export const dynamic = "force-dynamic";

export default async function CommandCenterLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await getCommandCenterContext();

  if (!context) {
    redirect("/crm/dashboard");
  }

  return <>{children}</>;
}
