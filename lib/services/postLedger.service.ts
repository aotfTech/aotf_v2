import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { InternalError, NotFoundError } from "@/lib/errors";
import Post, { type IPost } from "@/lib/models/Post";
import User from "@/lib/models/User";
import Profile from "@/lib/models/Profile";
import Application from "@/lib/models/Application";
import Admin from "@/lib/models/Admin";
import Invoice from "@/lib/models/Invoice";
import Referral from "@/lib/models/Referral";
import PostLedger, {
  type IPostLedger,
  type IPostLedgerStatusHistoryEntry,
  type IPostLedgerStudent,
  type PostLedgerStatus,
  type PaymentStatus,
} from "@/lib/models/PostLedger";
import { getGoogleSheetsClient, ensureTabExists } from "@/lib/googleSheets";
import { reportBackgroundError } from "@/lib/sentry-report";

// ─── Constants ────────────────────────────────────────────────────────────────

export const TUITIONS_TAB = "Tuitions";

export const TUITIONS_HEADERS = [
  "Serial No",          // A
  "Date",               // B
  "Tuition ID",         // C
  "Cancelled?",         // D
  "Guardian Name",      // E
  "Guardian Phone",     // F
  "Source",             // G
  "Referrer Name",      // H
  "Referrer Phone",     // I
  "Requirement",        // J
  "Notes",              // K
  "Paid?",              // L
  "Payment Date",       // M
  "Teacher Assigned?",  // N
  "Teacher Name",       // O
  "Teacher Phone",      // P
  "Teacher Gender",     // Q
  "Assigned Teacher Status", // R
  "Teacher Demo Date",  // S
  "Starting Date",      // T
  "Teacher Paid?",      // U
  "Teacher Payment Date", // V
  "Invoice?",           // W
  "Invoice ID",         // X
  "Class Type",         // Y
  "Location",           // Z
  "Monthly Budget",     // AA
  "Post Status",        // AB
  "Last Updated At",    // AC
  "Processed By Admin", // AD
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface IUserSnapshot {
  clerkId: string;
  username: string;
}

interface IProfileSnapshot {
  clerkId: string;
  displayName?: string | null;
  phone?: string | null;
  gender?: string | null;
}

interface IPostLedgerUpsertData {
  serialNumber: number | null;
  postCreatedAt: Date;
  postId: string;
  cancelledOrNot: boolean;
  guardianName: string;
  guardianPhone: string;
  source: string | null;
  referrerName: string | null;
  referrerPhone: string | null;
  requirement: string | null;
  notes: string | null;
  paymentStatus: PaymentStatus;
  paymentDate: Date | null;
  assignedTeacherId: string | null;
  assignedTeacherName: string | null;
  assignedTeacherPhone: string | null;
  teacherGender: string | null;
  assignedTeacherStatus: string | null;
  teacherDemoDate: Date | null;
  startingDate: Date | null;
  teacherHasBeenPaid: boolean;
  teacherPaymentDate: Date | null;
  invoiceGenerated: boolean;
  invoiceId: string | null;
  classType: string;
  location: string;
  monthlyBudget: number;
  postStatus: PostLedgerStatus;
  lastUpdatedAt: Date;
  processedByAdminName: string | null;
  // Other DB-only fields
  processedByAdminClerkId: string | null;
  enquiryId: string | null;
  students: IPostLedgerStudent[];
  assignedTeacherUsername: string | null;
  assignedAt: Date | null;
  paymentAmount: number | null;
  sheetRowIndex: number | null;
  statusHistory: IPostLedgerStatusHistoryEntry[];
  teacherChangeCount: number;
}

function mapPostStatus(postStatus: IPost["status"]): PostLedgerStatus {
  switch (postStatus) {
    case "matched":
      return "assigned";
    case "closed":
    case "cancelled":
      return "closed";
    case "open":
    case "hold":
    default:
      return "open";
  }
}

function getProcessedByAdminClerkId(post: IPost): string | null {
  return post.updatedByAdminClerkId ?? post.createdByAdminClerkId ?? null;
}

export function formatDateIST(date: Date | null | undefined): string {
  if (!date) return "";

  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value;

  const day = getPart("day") ?? "";
  const month = getPart("month") ?? "";
  const year = getPart("year") ?? "";
  const hour = getPart("hour") ?? "";
  const minute = getPart("minute") ?? "";

  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function formatDateOnlyIST(date: Date | null | undefined): string {
  if (!date) return "";

  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return dtf.format(date);
}

/** Build a human-readable requirement summary from PostLedger students */
function buildRequirementSummary(students: IPostLedgerStudent[]): string {
  return students
    .map((s) => `${s.className} (${s.board}) — ${s.subjects.join(", ")}`)
    .join(" | ");
}

// ─── Sheet row mapper (27 columns A–AA) ──────────────────────────────────────

export function postLedgerToSheetRowValues(
  ledger: IPostLedger,
): (string | number)[] {
  return [
    // A: Serial No
    ledger.serialNumber ?? "",

    // B: Date (post created at)
    formatDateIST(ledger.postCreatedAt),

    // C: Tuition ID
    ledger.postId,

    // D: Cancelled?
    ledger.cancelledOrNot ? "YES" : "NO",

    // E: Guardian Name
    ledger.guardianName,

    // F: Guardian Phone
    ledger.guardianPhone,

    // G: Source
    ledger.source ?? "",

    // H: Referrer Name
    ledger.referrerName ?? "",

    // I: Referrer Phone
    ledger.referrerPhone ?? "",

    // J: Requirement
    ledger.requirement ?? "",

    // K: Notes
    ledger.notes ?? "",

    // L: Paid?
    ledger.paymentStatus,

    // M: Payment Date
    formatDateOnlyIST(ledger.paymentDate),

    // N: Teacher Assigned?
    ledger.assignedTeacherId ? "YES" : "NO",

    // O: Teacher Name
    ledger.assignedTeacherName ?? "",

    // P: Teacher Phone
    ledger.assignedTeacherPhone ?? "",

    // Q: Teacher Gender
    ledger.teacherGender ?? "",

    // R: Assigned Teacher Status
    ledger.assignedTeacherStatus ?? "",

    // S: Teacher Demo Date
    formatDateIST(ledger.teacherDemoDate),

    // T: Starting Date
    formatDateIST(ledger.startingDate),

    // U: Teacher Paid?
    ledger.teacherHasBeenPaid ? "YES" : "NO",

    // V: Teacher Payment Date
    formatDateIST(ledger.teacherPaymentDate),

    // W: Invoice?
    ledger.invoiceGenerated ? "YES" : "NO",

    // X: Invoice ID
    ledger.invoiceId ?? "",

    // Y: Class Type
    ledger.classType,

    // Z: Location
    ledger.location,

    // AA: Monthly Budget
    ledger.monthlyBudget,

    // AB: Post Status
    ledger.postStatus,

    // AC: Last Updated At
    formatDateIST(ledger.lastUpdatedAt),

    // AD: Processed By Admin (fallback to clerk id if name is missing)
    ledger.processedByAdminName || ledger.processedByAdminClerkId || "",
  ];
}

// ─── Sheet row index parser ───────────────────────────────────────────────────

function parseRowNumberFromA1Range(updatedRange: string | undefined): number | null {
  if (!updatedRange) return null;
  const tail = updatedRange.split(":").at(-1);
  const match = tail?.match(/(\d+)\s*$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Sheet sync ───────────────────────────────────────────────────────────────

export async function syncPostLedgerRowToSheet(ledger: IPostLedger): Promise<void> {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.error("[syncPostLedgerRowToSheet] Missing env var: GOOGLE_SHEET_ID");
      reportBackgroundError(new Error("Missing env var: GOOGLE_SHEET_ID"), {
        operation: "sync-post-ledger-row",
        integration: "google-sheets",
        extra: { postId: ledger.postId, reason: "missing-spreadsheet-id" },
      });
      return;
    }

    const sheets = await getGoogleSheetsClient();
    await ensureTabExists(sheets, spreadsheetId, TUITIONS_TAB, TUITIONS_HEADERS);
    const rowValues = postLedgerToSheetRowValues(ledger);
    const lastCol = "AD";

    // For Tuitions, the row index is always serialNumber + 1 (to preserve header at row 1).
    // If serialNumber is somehow missing, fallback to sheetRowIndex, but this should be rare.
    const rowIndex = ledger.serialNumber ? ledger.serialNumber + 1 : ledger.sheetRowIndex;
    
    if (!rowIndex) {
      console.error("[syncPostLedgerRowToSheet] Missing serialNumber and sheetRowIndex for ledger:", ledger.postId);
      reportBackgroundError(new Error("Post ledger has no sheet row index"), {
        operation: "sync-post-ledger-row",
        integration: "google-sheets",
        extra: { postId: ledger.postId, reason: "missing-row-index" },
      });
      return;
    }

    const range = `${TUITIONS_TAB}!A${rowIndex}:${lastCol}${rowIndex}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    
    // Ensure sheetRowIndex in DB is correct (in case it wasn't already)
    if (ledger.sheetRowIndex !== rowIndex) {
      await PostLedger.updateOne(
        { postId: ledger.postId },
        { $set: { sheetRowIndex: rowIndex } },
      ).exec();
    }

  } catch (err) {
    console.error(
      "[syncPostLedgerRowToSheet] Error syncing for postId:",
      ledger.postId,
      err,
    );
    reportBackgroundError(err, {
      operation: "sync-post-ledger-row",
      integration: "google-sheets",
      extra: { postId: ledger.postId },
    });
  }
}

// ─── Upsert PostLedger ────────────────────────────────────────────────────────

export async function upsertPostLedger(postId: string): Promise<IPostLedger> {
  await dbConnect();

  const post = await Post.findOne({ postId }).lean<IPost>();
  if (!post) {
    throw new NotFoundError("Post");
  }

  const postLedgerStatus = mapPostStatus(post.status);
  const processedByAdminClerkId = getProcessedByAdminClerkId(post);

  // ─── Resolve processedByAdminName ─────────────────────────────────────────
  let processedByAdminName: string | null = null;
  if (processedByAdminClerkId) {
    const admin = await Admin.findOne({ clerkId: processedByAdminClerkId }).lean<{ name: string }>();
    if (admin) {
      processedByAdminName = admin.name ?? null;
    }
  }

  // ─── Resolve assignedTeacherId ────────────────────────────────────────────
  // Priority: 1. approved, 2. GC, 3. DC. If none of these, fallback to post.matchedTeacherClerkId
  let assignedTeacherId: string | null = null;
  let assignedTeacherStatus: string | null = null;
  
  const activeApplications = await Application.find({
    postId,
    status: mongoose.trusted({ $in: ["approved", "GC", "DC"] }),
  })
    .select("status applicantId")
    .lean<{ status: string; applicantId: any }[]>();

  if (activeApplications.length > 0) {
    // Sort by priority
    const priority = { approved: 1, GC: 2, DC: 3 };
    activeApplications.sort((a, b) => (priority[a.status as keyof typeof priority] || 99) - (priority[b.status as keyof typeof priority] || 99));
    
    const chosenApp = activeApplications[0];
    assignedTeacherStatus = chosenApp.status;
    const teacherUser = await User.findById(chosenApp.applicantId).select("clerkId").lean<{ clerkId: string }>();
    if (teacherUser) {
      assignedTeacherId = teacherUser.clerkId;
    }
  }

  if (!assignedTeacherId) {
    assignedTeacherId = post.matchedTeacherClerkId ?? null;
  }
  
  const source: string | null = post.source ?? null;

  let referrerName: string | null = null;
  let referrerPhone: string | null = null;

  if (source === "referral") {
    const referral = await Referral.findOne({ postId }).lean<{ referralUserName?: string; referralPhoneNumber?: string }>();
    if (referral) {
      referrerName = referral.referralUserName ?? null;
      referrerPhone = referral.referralPhoneNumber ?? null;
    }
  }

  const existingLedger = await PostLedger.findOne({ postId }).lean<IPostLedger>();

  const teacherChangeCountBase = existingLedger?.teacherChangeCount ?? 0;
  const assignedTeacherIdPrev: string | null = existingLedger?.assignedTeacherId ?? null;
  const teacherChangeCount =
    assignedTeacherIdPrev &&
    assignedTeacherId &&
    assignedTeacherIdPrev !== assignedTeacherId
      ? teacherChangeCountBase + 1
      : teacherChangeCountBase;

  const sheetRowIndex: number | null = existingLedger?.sheetRowIndex ?? null;

  const statusHistoryBase: IPostLedgerStatusHistoryEntry[] =
    existingLedger?.statusHistory ?? [];
  const lastStatusEntry = statusHistoryBase.at(-1) ?? null;
  const shouldAppendStatus =
    !lastStatusEntry || lastStatusEntry.status !== postLedgerStatus;

  const statusHistory: IPostLedgerStatusHistoryEntry[] = shouldAppendStatus
    ? [
        ...statusHistoryBase,
        {
          status: postLedgerStatus,
          changedAt: new Date(),
          changedByClerkId: processedByAdminClerkId,
        },
      ]
    : statusHistoryBase;

  // ─── Teacher snapshot ──────────────────────────────────────────────────────
  let assignedTeacherName: string | null = existingLedger?.assignedTeacherName ?? null;
  let assignedTeacherUsername: string | null = existingLedger?.assignedTeacherUsername ?? null;
  let assignedTeacherPhone: string | null = existingLedger?.assignedTeacherPhone ?? null;
  let teacherGender: string | null = existingLedger?.teacherGender ?? null;

  if (assignedTeacherId) {
    const isSameTeacherAsExisting =
      existingLedger?.assignedTeacherId === assignedTeacherId;

    const [teacherUser, teacherProfile] = await Promise.all([
      User.findOne({ clerkId: assignedTeacherId }).lean<IUserSnapshot>(),
      Profile.findOne({ clerkId: assignedTeacherId }).lean<IProfileSnapshot>(),
    ]);

    assignedTeacherName = isSameTeacherAsExisting
      ? existingLedger?.assignedTeacherName ?? null
      : teacherProfile?.displayName?.trim() ||
        teacherUser?.username?.trim() ||
        null;

    assignedTeacherUsername = isSameTeacherAsExisting
      ? existingLedger?.assignedTeacherUsername ?? null
      : teacherUser?.username?.trim() || null;

    assignedTeacherPhone = isSameTeacherAsExisting
      ? existingLedger?.assignedTeacherPhone ?? null
      : teacherProfile?.phone?.trim() || null;

    teacherGender = isSameTeacherAsExisting
      ? existingLedger?.teacherGender ?? null
      : teacherProfile?.gender ?? null;
  }

  // assignedAt: keep the first value once set
  let assignedAt: Date | null = existingLedger?.assignedAt ?? null;
  if (assignedTeacherId && !assignedAt) {
    assignedAt = new Date();
  }

  // Serial number: assign once, never change
  const serialNumber: number | null = existingLedger?.serialNumber ?? null;
  const serialNumberFinal: number | null =
    serialNumber === null || serialNumber === undefined
      ? (await PostLedger.countDocuments()) + 1
      : serialNumber;

  // ─── New computed fields ───────────────────────────────────────────────────

  const cancelledOrNot = post.status === "cancelled";
  const requirement = buildRequirementSummary(post.students as IPostLedgerStudent[]);

  // Teacher demo date: from the approved application's dcDate
  let teacherDemoDate: Date | null = existingLedger?.teacherDemoDate ?? null;
  if (assignedTeacherId && !teacherDemoDate) {
    const approvedApp = await Application.findOne({
      postId: post.postId,   // postId is stored as String on Application
      status: "approved",
    })
      .select("dcDate")
      .lean<{ dcDate?: Date }>();
    teacherDemoDate = approvedApp?.dcDate ?? null;
  }


  // startingDate: preserve from existing ledger (admin-entered via UI)
  const startingDate: Date | null = existingLedger?.startingDate ?? null;

  // Teacher payment: preserve from existing ledger (admin-entered via UI)
  const teacherHasBeenPaid: boolean = existingLedger?.teacherHasBeenPaid ?? false;
  const teacherPaymentDate: Date | null = existingLedger?.teacherPaymentDate ?? null;

  // Invoice: look up latest invoice linked to this postId
  let invoiceGenerated = false;
  let invoiceId: string | null = null;
  let paymentStatus: PaymentStatus = "unpaid";
  let paymentDate: Date | null = null;
  let paymentAmount: number | null = null;

  const latestInvoice = await Invoice.findOne({ postId: post.postId, isLatest: true })
    .select("invoiceId paymentStatus paymentDate amount.total")
    .lean<{ invoiceId: string; paymentStatus: string; paymentDate?: Date; amount?: { total?: number } }>();

  if (latestInvoice) {
    invoiceGenerated = true;
    invoiceId = latestInvoice.invoiceId;
    
    // Fallbacks per user request: Invoice -> Post (monthlyBudget)
    paymentStatus = (latestInvoice.paymentStatus as PaymentStatus) || "unpaid";
    paymentDate = latestInvoice.paymentDate ?? null;
    paymentAmount = latestInvoice.amount?.total ?? post.monthlyBudget;
  } else {
    paymentStatus = post.paymentstatus === "done" ? "paid" : "unpaid";
    paymentDate = post.paymentDate ?? null;
    paymentAmount = post.monthlyBudget;
  }

  // ─── Assemble & upsert ────────────────────────────────────────────────────

  const ledgerData: IPostLedgerUpsertData = {
    serialNumber: serialNumberFinal,
    postCreatedAt: post.createdAt,
    postId: post.postId,
    cancelledOrNot,
    guardianName: post.guardianName,
    guardianPhone: post.guardianPhone,
    source,
    referrerName,
    referrerPhone,
    requirement,
    notes: post.notes ?? null,
    paymentStatus,
    paymentDate,
    assignedTeacherId,
    assignedTeacherName,
    assignedTeacherPhone,
    teacherGender,
    assignedTeacherStatus,
    teacherDemoDate,
    startingDate,
    teacherHasBeenPaid,
    teacherPaymentDate,
    invoiceGenerated,
    invoiceId,
    classType: post.classType,
    location: post.location,
    monthlyBudget: post.monthlyBudget,
    postStatus: postLedgerStatus,
    lastUpdatedAt: new Date(),
    processedByAdminName,
    // Other DB-only fields
    processedByAdminClerkId,
    enquiryId: post.enquiryId ? post.enquiryId.toString() : null,
    students: post.students as IPostLedgerStudent[],
    assignedTeacherUsername,
    assignedAt,
    paymentAmount,
    sheetRowIndex,
    statusHistory,
    teacherChangeCount,
  };

  const upserted = await PostLedger.findOneAndUpdate(
    { postId },
    { $set: ledgerData },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  if (!upserted) {
    throw new InternalError("Failed to upsert PostLedger");
  }

  // Fire-and-forget: keep the API response snappy.
  syncPostLedgerRowToSheet(upserted).catch((err) =>
    reportBackgroundError(err, {
      operation: "sync-post-ledger-row",
      integration: "google-sheets",
      extra: { postId },
    }),
  );

  return upserted;
}
