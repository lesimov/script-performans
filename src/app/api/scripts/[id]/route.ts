import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { Script } from "@/lib/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const deleted = await queryOne<Script>(
    "DELETE FROM scripts WHERE id = $1 RETURNING *",
    [id]
  );

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted });
}