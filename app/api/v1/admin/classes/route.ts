import { NextResponse } from "next/server";
import { listClasses, createClass } from "@/lib/services/adminOptions.service";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import Admin from "@/lib/models/Admin";
import { logActivity } from "@/lib/admin/logActivity";
import dbConnect from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";

export async function GET() {
  const classes = await listClasses();
  return NextResponse.json({ classes });
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const currentAdmin = await Admin.findOne({ clerkId: userId }).lean();
    if (!currentAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const schema = z.object({ key: z.string().min(1), label: z.string().min(1) });
    const data = schema.parse(body);
    const cls = await createClass(data);

    await logActivity({
      admin: currentAdmin as any,
      action: "CREATE_CLASS",
      module: "ADMIN_MGMT",
      targetType: "Class",
      targetId: cls._id as any,
      targetRefId: cls.key,
      metadata: { label: cls.label },
    });

    return NextResponse.json({ class: cls });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/admin/classes");
  }
}
