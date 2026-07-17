import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { isAllowedScriptUrl, isScriptType, Script } from "@/lib/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!/^[1-9]\d*$/.test(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;
  const updates: string[] = [];
  const values: unknown[] = [];
  const addUpdate = (column: string, value: unknown) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if ("name" in input) {
    if (typeof input.name !== "string" || input.name.trim() === "") {
      return NextResponse.json({ error: "name must be non-empty" }, { status: 400 });
    }
    addUpdate("name", input.name.trim());
  }
  if ("slug" in input) {
    if (typeof input.slug !== "string" || input.slug.trim() === "") {
      return NextResponse.json({ error: "slug must be non-empty" }, { status: 400 });
    }
    addUpdate("slug", input.slug.trim());
  }
  if ("url" in input) {
    if (typeof input.url !== "string" || input.url.trim() === "") {
      return NextResponse.json({ error: "url must be non-empty" }, { status: 400 });
    }
    addUpdate("url", input.url.trim());
    if (!isAllowedScriptUrl(input.url)) {
      return NextResponse.json(
        { error: "url must point to an allowed 5metrics.dev page" },
        { status: 400 }
      );
    }
  }
  if ("script_type" in input) {
    if (!isScriptType(input.script_type)) {
      return NextResponse.json(
        { error: "script_type must be owned or competitor" },
        { status: 400 }
      );
    }
    addUpdate("script_type", input.script_type);
  }
  if ("is_active" in input) {
    if (typeof input.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active must be a boolean" },
        { status: 400 }
      );
    }
    addUpdate("is_active", input.is_active);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  values.push(id);
  try {
    const updated = await queryOne<Script>(
      `UPDATE scripts
       SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json({ error: "slug already exists" }, { status: 409 });
    }
    throw error;
  }
}