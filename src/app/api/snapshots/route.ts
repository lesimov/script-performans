import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { normalizeCrawlData, Snapshot } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scriptIdParam = searchParams.get("script_id");
  const limitParam = searchParams.get("limit");
  if (scriptIdParam !== null && !/^[1-9]\d*$/.test(scriptIdParam)) {
    return NextResponse.json(
      { error: "script_id must be a positive integer" },
      { status: 400 }
    );
  }
  if (limitParam !== null && !/^[1-9]\d*$/.test(limitParam)) {
    return NextResponse.json(
      { error: "limit must be a positive integer" },
      { status: 400 }
    );
  }
  const scriptId = scriptIdParam === null ? null : Number(scriptIdParam);
  const limit = limitParam === null ? 60 : Number(limitParam);
  if (
    (scriptId !== null &&
      (!Number.isSafeInteger(scriptId) || scriptId > 2147483647)) ||
    !Number.isSafeInteger(limit) ||
    limit > 365
  ) {
    return NextResponse.json(
      { error: "Invalid snapshot query range" },
      { status: 400 }
    );
  }

  let sql = "SELECT * FROM snapshots";
  const params: any[] = [];

  if (scriptId !== null) {
    sql += " WHERE script_id = $1";
    params.push(scriptId);
  }

  sql += " ORDER BY date DESC LIMIT $" + (params.length + 1);
  params.push(limit);

  const snapshots = await query<Snapshot>(sql, params);
  return NextResponse.json(
    snapshots.map((snapshot) => ({
      ...snapshot,
      raw_data: normalizeCrawlData(snapshot.raw_data),
    }))
  );
}