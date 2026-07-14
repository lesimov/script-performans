import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { Script } from "@/lib/types";

export async function GET() {
  const scripts = await query<Script>(
    "SELECT * FROM scripts ORDER BY created_at DESC"
  );
  return NextResponse.json(scripts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, slug, url } = body;

  if (!name || !slug || !url) {
    return NextResponse.json(
      { error: "name, slug, url required" },
      { status: 400 }
    );
  }

  const existing = await queryOne<Script>(
    "SELECT id FROM scripts WHERE slug = ?",
    [slug]
  );
  if (existing) {
    return NextResponse.json(
      { error: "slug already exists" },
      { status: 409 }
    );
  }

  await query(
    `INSERT INTO scripts (name, slug, url)
     VALUES (?, ?, ?)`,
    [name, slug, url]
  );

  const script = await queryOne<Script>(
    "SELECT * FROM scripts WHERE slug = ?",
    [slug]
  );

  return NextResponse.json(script, { status: 201 });
}