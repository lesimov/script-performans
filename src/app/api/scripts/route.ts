import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { isAllowedScriptUrl, isScriptType, Script } from "@/lib/types";

const SCRIPT_COLUMNS =
  "id, name, slug, url, script_type, is_active, created_at, updated_at";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scriptType = searchParams.get("type");
  const active = searchParams.get("active");

  if (scriptType !== null && !isScriptType(scriptType)) {
    return NextResponse.json(
      { error: "type must be owned or competitor" },
      { status: 400 }
    );
  }
  if (active !== null && active !== "true" && active !== "false") {
    return NextResponse.json(
      { error: "active must be true or false" },
      { status: 400 }
    );
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (scriptType !== null) {
    params.push(scriptType);
    conditions.push(`script_type = $${params.length}`);
  }
  if (active !== null) {
    params.push(active === "true");
    conditions.push(`is_active = $${params.length}`);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const scripts = await query<Script>(
    `SELECT ${SCRIPT_COLUMNS} FROM scripts${where} ORDER BY created_at DESC`,
    params
  );
  return NextResponse.json(scripts);
}

export async function POST(req: NextRequest) {
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
  const { name, slug, url } = input;
  const scriptType = input.script_type ?? "owned";
  const isActive = input.is_active ?? true;

  if (
    !isNonEmptyString(name) ||
    !isNonEmptyString(slug) ||
    !isNonEmptyString(url)
  ) {
    return NextResponse.json(
      { error: "name, slug, url must be non-empty strings" },
      { status: 400 }
    );
  }
  if (!isAllowedScriptUrl(url)) {
    return NextResponse.json(
      { error: "url must point to an allowed 5metrics.dev page" },
      { status: 400 }
    );
  }
  if (!isScriptType(scriptType)) {
    return NextResponse.json(
      { error: "script_type must be owned or competitor" },
      { status: 400 }
    );
  }
  if (typeof isActive !== "boolean") {
    return NextResponse.json(
      { error: "is_active must be a boolean" },
      { status: 400 }
    );
  }

  const normalizedName = name.trim();
  const normalizedSlug = slug.trim();
  const normalizedUrl = url.trim();
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM scripts WHERE slug = $1",
    [normalizedSlug]
  );
  if (existing) {
    return NextResponse.json(
      { error: "slug already exists" },
      { status: 409 }
    );
  }

  try {
    const script = await queryOne<Script>(
      `INSERT INTO scripts (name, slug, url, script_type, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SCRIPT_COLUMNS}`,
      [normalizedName, normalizedSlug, normalizedUrl, scriptType, isActive]
    );

    return NextResponse.json(script, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "slug already exists" },
        { status: 409 }
      );
    }
    throw error;
  }
}