import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  checkCsrfOrigin,
  checkRateLimit,
  getClientIp,
  checkJsonContentType,
} from "@/lib/api-utils";
import { createRateLimiter } from "@/lib/rate-limit";
import Admin from "@/lib/models/Admin";
import dbConnect from "@/lib/db";
import {
  createFeedbackSchema,
  listFeedbacksSchema,
} from "@/lib/validations/feedback";
import { createFeedback, listFeedbacks } from "@/lib/services/feedback.service";

const submitLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const readLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export async function POST(request: NextRequest) {
  try {
    const csrfBlock = checkCsrfOrigin(request);
    if (csrfBlock) return csrfBlock;

    const ctBlock = checkJsonContentType(request);
    if (ctBlock) return ctBlock;

    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(submitLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = createFeedbackSchema.parse(body);
    const feedback = await createFeedback(clerkId, input);

    return NextResponse.json(
      { message: "Feedback submitted successfully", feedback },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/v1/feedback");
  }
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(readLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metadata = sessionClaims?.publicMetadata as Record<string, unknown>;
    const isAdminFromMetadata = metadata?.isAdmin === true;

    await dbConnect();
    const currentAdmin = await Admin.findOne({ clerkId: userId });

    // Match proxy behavior: accept DB-backed admin when Clerk metadata is stale.
    if (!isAdminFromMetadata && !currentAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (
      (!currentAdmin.isActive && (currentAdmin as any).status !== "ACTIVE") ||
      !(currentAdmin.permissions?.canHandleFeedbacks || (metadata?.permissions as Record<string, boolean>)?.canHandleFeedbacks || metadata?.canHandleFeedbacks)
    ) {
      return NextResponse.json(
        { error: "You do not have permission to view feedbacks" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const input = listFeedbacksSchema.parse({
      status: searchParams.get("status") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const result = await listFeedbacks(input);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "GET /api/v1/feedback");
  }
}
