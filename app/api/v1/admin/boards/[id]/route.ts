import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteBoardById, updateBoardById } from "@/lib/services/adminOptions.service";
import { handleApiError } from "@/lib/api-utils";

const schema = z.object({ key: z.string().min(1), label: z.string().min(1) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const { id } = await params;
    const board = await updateBoardById(id, data);
    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }
    return NextResponse.json({ board });
  } catch (err) {
    return handleApiError(err, "PATCH /api/v1/admin/boards/[id]");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const board = await deleteBoardById(id);
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
