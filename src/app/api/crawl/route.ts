import { NextResponse } from "next/server";
import { crawlAll } from "@/lib/crawl";

export async function POST() {
  const result = await crawlAll();
  return NextResponse.json(result);
}