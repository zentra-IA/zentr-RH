import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCandidatePortalToken } from "@/lib/candidate-portal-access";

export const dynamic = "force-dynamic";

const EVENTS = new Set(["clicked", "opened", "viewed"]);

export async function POST(
  req: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const token = decodeURIComponent(params.token);
    const profile = await resolveCandidatePortalToken(token);
    const body = await req.json().catch(() => ({}));

    const deliveryId = String(body?.deliveryId || "").trim();
    const notificationId = String(body?.notificationId || "").trim();
    const event = String(body?.event || "").trim().toLowerCase();

    if (!deliveryId || !notificationId || !EVENTS.has(event)) {
      return NextResponse.json(
        { success: false, error: "Tracking inválido." },
        { status: 400 }
      );
    }

    if (event === "clicked") {
      await prisma.$executeRaw`
        UPDATE "candidate_notification_deliveries" d
        SET
          "status" = 'clicked',
          "clicked_at" = COALESCE("clicked_at", now())
        FROM "candidate_notifications" n
        WHERE d."id" = ${deliveryId}::uuid
          AND d."notification_id" = ${notificationId}::uuid
          AND n."id" = d."notification_id"
          AND n."profile_id" = ${profile.id}::uuid
      `;
    }

    if (event === "opened") {
      await prisma.$executeRaw`
        UPDATE "candidate_notification_deliveries" d
        SET
          "status" = 'opened',
          "opened_at" = COALESCE("opened_at", now())
        FROM "candidate_notifications" n
        WHERE d."id" = ${deliveryId}::uuid
          AND d."notification_id" = ${notificationId}::uuid
          AND n."id" = d."notification_id"
          AND n."profile_id" = ${profile.id}::uuid
      `;
    }

    if (event === "viewed") {
      await prisma.$executeRaw`
        UPDATE "candidate_notification_deliveries" d
        SET
          "status" = 'viewed',
          "viewed_at" = COALESCE("viewed_at", now())
        FROM "candidate_notifications" n
        WHERE d."id" = ${deliveryId}::uuid
          AND d."notification_id" = ${notificationId}::uuid
          AND n."id" = d."notification_id"
          AND n."profile_id" = ${profile.id}::uuid
      `;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
