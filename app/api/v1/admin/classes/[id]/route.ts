import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteClassById, updateClassById } from "@/lib/services/adminOptions.service";
import { handleApiError } from "@/lib/api-utils";

const schema = z.object({ key: z.string().min(1), label: z.string().min(1) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const { id } = await params;
    const cls = await updateClassById(id, data);
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    return NextResponse.json({ class: cls });
  } catch (err) {
    return handleApiError(err, "PATCH /api/v1/admin/classes/[id]");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cls = await deleteClassById(id);
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
