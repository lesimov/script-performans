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
    "SELECT id FROM scripts WHERE slug = $1",
    [slug]
  );
  if (existing) {
    return NextResponse.json(
      { error: "slug already exists" },
      { status: 409 }
    );
  }

  const script = await queryOne<Script>(
    `INSERT INTO scripts (name, slug, url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, slug, url]
  );

  return NextResponse.json(script, { status: 201 });
}