import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { Snapshot } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scriptId = searchParams.get("script_id");
  const limit = parseInt(searchParams.get("limit") || "60", 10);

  let sql = "SELECT * FROM snapshots";
  const params: any[] = [];

  if (scriptId) {
    sql += " WHERE script_id = $1";
    params.push(parseInt(scriptId, 10));
  }

  sql += " ORDER BY date DESC LIMIT $" + (params.length + 1);
  params.push(limit);

  const snapshots = await query<Snapshot>(sql, params);
  return NextResponse.json(snapshots);
}