import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { Script } from "@/lib/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await queryOne<Script>(
    "SELECT id, name, slug FROM scripts WHERE id = ?",
    [id]
  );
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await query("DELETE FROM scripts WHERE id = ?", [id]);
  return NextResponse.json({ deleted: existing });
}