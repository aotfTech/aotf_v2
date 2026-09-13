import { NextResponse } from "next/server";
import crypto from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Payment from "@/lib/models/Payment";
import OnboardingDetails from "@/lib/models/OnboardingDetails";
import WebhookEvent from "@/lib/models/WebhookEvent";

import { reportError } from "@/lib/sentry-report";

// ── Helpers ─────────────────────────────────────────────────────────

type PayloadMap = Record<string, Record<string, Record<string, unknown>>>;

/** Extract the primary entity id and related order id from the webhook payload. */
function extractIds(event: string, rawPayload: PayloadMap) {
  // order.* events carry the entity under payload.order.entity
  if (event.startsWith("order.")) {
    const orderEntity = rawPayload?.order?.entity;
    return {
      entityId: (orderEntity?.id as string) ?? "",
      orderId: (orderEntity?.id as string) ?? null,
    };
  }
  // refund.* events carry the entity under payload.refund.entity
  if (event.startsWith("refund.")) {
    const refundEntity = rawPayload?.refund?.entity;
    return {
      entityId: (refundEntity?.id as string) ?? "",
      orderId: (refundEntity?.order_id as string) ?? null,
    };
  }
  // payment.dispute.* events carry the entity under payload.dispute.entity
  if (event.startsWith("payment.dispute.")) {
    const disputeEntity = rawPayload?.dispute?.entity;
    return {
      entityId: (disputeEntity?.id as string) ?? "",
      orderId: (disputeEntity?.payment_id as string) ?? null,
    };
  }
  // Default: payment.* events
  const paymentEntity = rawPayload?.payment?.entity;
  return {
    entityId: (paymentEntity?.id as string) ?? "",
    orderId: (paymentEntity?.order_id as string) ?? null,
  };
}

// ── Main handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  // Verify Razorpay webhook signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");

  if (
    !signature ||
    !crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex"),
    )
  ) {
    console.error("[razorpay-webhook] Signature verification failed");
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = payload.event as string;
  const { entityId, orderId } = extractIds(
    event,
    payload.payload as PayloadMap,
  );

  console.log(
    `[razorpay-webhook] Received event: ${event}, entityId: ${entityId}`,
  );

  await dbConnect();

  // Idempotency: insert webhook event, skip if duplicate
  try {
    await WebhookEvent.create({
      provider: "razorpay",
      event,
      entityId,
      orderId,
      payload,
      signature,
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      console.log(
        `[razorpay-webhook] Duplicate event ${event}:${entityId}, returning 200`,
      );
      return NextResponse.json({ received: true });
    }
    throw err;
  }

  try {
    switch (event) {
      case "payment.authorized":
        await handlePaymentAuthorized(entityId, orderId);
        break;
      case "payment.captured":
      case "order.paid":
        await handlePaymentSuccess(entityId, orderId);
        break;
      case "payment.failed":
        await handlePaymentFailed(entityId, orderId);
        break;
      case "refund.created":
        await handleRefundCreated(orderId);
        break;
      case "payment.dispute.created":
        await handleDisputeCreated(payload.payload as PayloadMap);
        break;
      case "payment.dispute.closed":
        await handleDisputeClosed(payload.payload as PayloadMap);
        break;
      default:
        console.log(`[razorpay-webhook] Unhandled event: ${event}`);
    }

    await WebhookEvent.updateOne(
      { provider: "razorpay", event, entityId },
      { processed: true, processedAt: new Date() },
    );
  } catch (err) {
    console.error(`[razorpay-webhook] Error processing ${event}:`, err);
    reportError(err, {
      tags: { provider: "razorpay", event },
      extra: { entityId, orderId },
    });
    await WebhookEvent.updateOne(
      { provider: "razorpay", event, entityId },
      { error: err instanceof Error ? err.message : "Unknown error" },
    );
  }

  // Always return 200 to prevent Razorpay retries for processing errors
  return NextResponse.json({ received: true });
}

// ── Event handlers ──────────────────────────────────────────────────

/** payment.authorized — logged; no state change (auto-capture is on). */
async function handlePaymentAuthorized(
  paymentId: string,
  orderId: string | null,
) {
  console.log(
    `[razorpay-webhook] payment.authorized: ${paymentId}, order: ${orderId}`,
  );
}

/**
 * payment.captured / order.paid — mark payment as paid, upgrade user plan,
 * clear OnboardingDetails TTL, sync Clerk metadata.
 */
async function handlePaymentSuccess(paymentId: string, orderId: string | null) {
  if (!orderId) {
    console.warn("[razorpay-webhook] payment success without order_id");
    return;
  }

  const payment = await Payment.findOne({ providerOrderId: orderId });
  if (!payment) {
    console.warn(`[razorpay-webhook] No payment record for order ${orderId}`);
    return;
  }

  // Idempotency: already processed
  if (payment.status === "paid") {
    // Repair the user if the payment was persisted before the prior user
    // update completed.
    await User.updateOne(
      { _id: payment.userId },
      {
        "plan.current": payment.toPlan,
        "plan.hasTuitionAccess": true,
        "plan.hasCandidateAccess": payment.toPlan === "teacher_candidate",
        "plan.activatedAt": payment.paidAt ?? new Date(),
        onboardingCompleted: true,
        paymentCompleted: true,
        registrationPaymentId: payment._id,
        role: payment.toPlan,
      },
    );
    console.log(
      `[razorpay-webhook] Payment for order ${orderId} already marked paid`,
    );
    return;
  }

  payment.status = "paid";
  payment.providerPaymentId = paymentId;
  payment.paidAt = new Date();
  await payment.save();

  const toPlan = payment.toPlan;

  await User.updateOne(
    { _id: payment.userId },
    {
      "plan.current": toPlan,
      "plan.hasTuitionAccess": true,
      "plan.hasCandidateAccess": toPlan === "teacher_candidate",
      "plan.activatedAt": new Date(),
      onboardingCompleted: true,
      paymentCompleted: true,
      registrationPaymentId: payment._id,
      role: toPlan,
    },
  );

  // Clear TTL so MongoDB doesn't auto-delete the onboarding record
  await OnboardingDetails.updateOne(
    { clerkId: payment.clerkId },
    { $set: { expiresAt: null, status: "completed" } },
  );

  // Sync to Clerk
  const client = await clerkClient();
  await client.users.updateUserMetadata(payment.clerkId, {
    publicMetadata: {
      onboardingCompleted: true,
      paymentCompleted: true,
      role: toPlan,
    },
  });

  console.log(
    `[razorpay-webhook] Fallback: verified payment for order ${orderId}, plan: ${toPlan}`,
  );
}

/** payment.failed — mark payment record as failed. */
async function handlePaymentFailed(paymentId: string, orderId: string | null) {
  if (!orderId) return;

  const payment = await Payment.findOne({ providerOrderId: orderId });
  if (!payment || payment.status === "paid") return;

  payment.status = "failed";
  payment.providerPaymentId = paymentId;
  await payment.save();

  // Keep the user explicitly unpaid after a failed attempt, without
  // overwriting a different successful payment that may have completed later.
  await User.updateOne(
    { _id: payment.userId, registrationPaymentId: { $ne: payment._id } },
    { paymentCompleted: false },
  );

  console.log(`[razorpay-webhook] Payment failed for order ${orderId}`);
}

/** refund.created — mark payment record as refunded, revoke plan access. */
async function handleRefundCreated(orderId: string | null) {
  if (!orderId) return;

  const payment = await Payment.findOne({ providerOrderId: orderId });
  if (!payment || payment.status === "refunded") return;

  payment.status = "refunded";
  await payment.save();

  // Revoke plan access
  await User.updateOne(
    { _id: payment.userId },
    {
      "plan.current": "teacher",
      "plan.hasTuitionAccess": false,
      "plan.hasCandidateAccess": false,
      "plan.activatedAt": null,
      onboardingCompleted: false,
      paymentCompleted: false,
      registrationPaymentId: null,
      role: "teacher",
    },
  );

  const client = await clerkClient();
  await client.users.updateUserMetadata(payment.clerkId, {
    publicMetadata: {
      onboardingCompleted: false,
      paymentCompleted: false,
      role: "teacher",
    },
  });

  console.log(`[razorpay-webhook] Refund processed for order ${orderId}`);
}

/** payment.dispute.created — flag user status as blocked. */
async function handleDisputeCreated(rawPayload: PayloadMap) {
  const disputeEntity = rawPayload?.dispute?.entity;
  const rzpPaymentId = (disputeEntity?.payment_id as string) ?? null;
  if (!rzpPaymentId) return;

  const payment = await Payment.findOne({ providerPaymentId: rzpPaymentId });
  if (!payment) return;

  await User.updateOne({ _id: payment.userId }, { status: "blocked" });

  console.log(
    `[razorpay-webhook] Dispute opened — user ${String(payment.userId)} blocked`,
  );
}

/** payment.dispute.closed — unblock user if dispute was won. */
async function handleDisputeClosed(rawPayload: PayloadMap) {
  const disputeEntity = rawPayload?.dispute?.entity;
  const rzpPaymentId = (disputeEntity?.payment_id as string) ?? null;
  const status = (disputeEntity?.status as string) ?? "";
  if (!rzpPaymentId) return;

  const payment = await Payment.findOne({ providerPaymentId: rzpPaymentId });
  if (!payment) return;

  // "won" = merchant won the dispute; "lost" = customer won (chargeback)
  if (status === "won") {
    await User.updateOne({ _id: payment.userId }, { status: "active" });
    console.log(
      `[razorpay-webhook] Dispute won — user ${String(payment.userId)} unblocked`,
    );
  } else {
    // Dispute lost — treat like a refund
    payment.status = "refunded";
    await payment.save();

    await User.updateOne(
      { _id: payment.userId },
      {
        status: "blocked",
        "plan.current": "teacher",
        "plan.hasTuitionAccess": false,
        "plan.hasCandidateAccess": false,
        "plan.activatedAt": null,
        onboardingCompleted: false,
        paymentCompleted: false,
        registrationPaymentId: null,
        role: "teacher",
      },
    );

    const client = await clerkClient();
    await client.users.updateUserMetadata(payment.clerkId, {
      publicMetadata: {
        onboardingCompleted: false,
        paymentCompleted: false,
        role: "teacher",
      },
    });

    console.log(
      `[razorpay-webhook] Dispute lost — user ${String(payment.userId)} remains blocked, plan revoked`,
    );
  }
}
