import { prisma } from "@/lib/prisma";
import { sendCandidateWebPush } from "@/lib/candidate-push";

type PendingDelivery = {
  delivery_id: string;
  notification_id: string;
  campaign_id: string | null;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  title: string;
  body: string;
  deep_link: string | null;
  type: string;
};

function pushType(value: string) {
  if (value === "INTERVIEW") return "INTERVIEW" as const;
  if (value === "PROCESS_UPDATE") return "PROCESS_UPDATE" as const;
  if (value === "MESSAGE") return "MESSAGE" as const;
  if (value === "DOCUMENT") return "DOCUMENT" as const;
  return "JOB_OPPORTUNITY" as const;
}

async function refreshCampaign(campaignId: string) {
  const counts = await prisma.$queryRaw<
    Array<{
      queued_count: bigint;
      sent_count: bigint;
      failed_count: bigint;
    }>
  >`
    SELECT
      COUNT(*) FILTER (
        WHERE d."status" = 'pending'
      )::bigint AS queued_count,
      COUNT(*) FILTER (
        WHERE d."status" IN ('sent','clicked','opened','viewed')
      )::bigint AS sent_count,
      COUNT(*) FILTER (
        WHERE d."status" = 'failed'
      )::bigint AS failed_count
    FROM "candidate_notification_deliveries" d
    INNER JOIN "candidate_notifications" n
      ON n."id" = d."notification_id"
    WHERE n."campaign_id" = ${campaignId}::uuid
  `;

  const row = counts[0];

  await prisma.$executeRaw`
    UPDATE "candidate_push_campaigns"
    SET
      "queued_count" = ${Number(row?.queued_count || 0)},
      "sent_count" = ${Number(row?.sent_count || 0)},
      "failed_count" = ${Number(row?.failed_count || 0)},
      "updated_at" = now()
    WHERE "id" = ${campaignId}::uuid
  `;
}

export async function processCandidatePushQueue(options?: {
  companyId?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(Number(options?.limit || 100), 300));
  const companyId = options?.companyId || null;

  const rows = companyId
    ? await prisma.$queryRaw<PendingDelivery[]>`
        SELECT
          d."id" AS delivery_id,
          d."notification_id",
          n."campaign_id",
          s."endpoint",
          s."p256dh",
          s."auth_key",
          n."title",
          n."body",
          n."deep_link",
          n."type"
        FROM "candidate_notification_deliveries" d
        INNER JOIN "candidate_notifications" n
          ON n."id" = d."notification_id"
        INNER JOIN "candidate_push_subscriptions" s
          ON s."id" = d."subscription_id"
        WHERE d."status" = 'pending'
          AND d."company_id" = ${companyId}::uuid
          AND s."active" = true
        ORDER BY d."queued_at" ASC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<PendingDelivery[]>`
        SELECT
          d."id" AS delivery_id,
          d."notification_id",
          n."campaign_id",
          s."endpoint",
          s."p256dh",
          s."auth_key",
          n."title",
          n."body",
          n."deep_link",
          n."type"
        FROM "candidate_notification_deliveries" d
        INNER JOIN "candidate_notifications" n
          ON n."id" = d."notification_id"
        INNER JOIN "candidate_push_subscriptions" s
          ON s."id" = d."subscription_id"
        WHERE d."status" = 'pending'
          AND s."active" = true
        ORDER BY d."queued_at" ASC
        LIMIT ${limit}
      `;

  let sent = 0;
  let failed = 0;
  const campaignIds = new Set<string>();

  async function processRow(row: PendingDelivery) {
    if (row.campaign_id) campaignIds.add(row.campaign_id);

    const separator = String(row.deep_link || "").includes("?")
      ? "&"
      : "?";

    const url = `${row.deep_link || "/"}${separator}src=push&notification_id=${encodeURIComponent(
      row.notification_id
    )}&delivery_id=${encodeURIComponent(row.delivery_id)}`;

    try {
      await sendCandidateWebPush(
        {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth_key,
          },
        },
        {
          title: row.title,
          body: row.body,
          url,
          type: pushType(row.type),
          tag: `motivar-${row.notification_id}`,
          requireInteraction: row.type === "INTERVIEW",
        }
      );

      sent += 1;

      await prisma.$executeRaw`
        UPDATE "candidate_notification_deliveries"
        SET
          "status" = 'sent',
          "sent_at" = now(),
          "error_code" = NULL,
          "error_message" = NULL
        WHERE "id" = ${row.delivery_id}::uuid
      `;
    } catch (error: any) {
      failed += 1;

      const statusCode = Number(
        error?.statusCode ||
          error?.status ||
          error?.response?.statusCode ||
          0
      );

      await prisma.$executeRaw`
        UPDATE "candidate_notification_deliveries"
        SET
          "status" = 'failed',
          "failed_at" = now(),
          "error_code" = ${statusCode ? String(statusCode) : "PUSH_ERROR"},
          "error_message" = ${String(
            error?.body || error?.message || "Falha no Web Push"
          ).slice(0, 2000)}
        WHERE "id" = ${row.delivery_id}::uuid
      `;

      if (statusCode === 404 || statusCode === 410) {
        await prisma.$executeRaw`
          UPDATE "candidate_push_subscriptions"
          SET
            "active" = false,
            "permission" = 'revoked',
            "revoked_at" = now(),
            "updated_at" = now()
          WHERE "endpoint" = ${row.endpoint}
        `;
      }
    }
  }

  for (let index = 0; index < rows.length; index += 15) {
    await Promise.all(rows.slice(index, index + 15).map(processRow));
  }

  for (const campaignId of campaignIds) {
    await refreshCampaign(campaignId);
  }

  return {
    processed: rows.length,
    sent,
    failed,
  };
}
