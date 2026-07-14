import { NextRequest, NextResponse } from "next/server";
import { crawlAll } from "@/lib/crawl";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await crawlAll();

  return NextResponse.json(result);
}