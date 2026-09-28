import { NextResponse } from "next/server";
import { listBoards, createBoard } from "@/lib/services/adminOptions.service";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import Admin from "@/lib/models/Admin";
import { logActivity } from "@/lib/admin/logActivity";
import dbConnect from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";

export async function GET() {
  const boards = await listBoards();
  return NextResponse.json({ boards });
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
    const board = await createBoard(data);

    await logActivity({
      admin: currentAdmin as any,
      action: "CREATE_BOARD",
      module: "ADMIN_MGMT",
      targetType: "Board",
      targetId: board._id as any,
      targetRefId: board.key,
      metadata: { label: board.label },
    });

    return NextResponse.json({ board });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/admin/boards");
  }
}
