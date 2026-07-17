import { NextRequest, NextResponse } from "next/server";
import { crawlAll } from "@/lib/crawl";

const MAX_SCRIPT_ID = 2147483647;
function isPositiveIntegerArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every(
      (item) =>
        Number.isSafeInteger(item) && item > 0 && item <= MAX_SCRIPT_ID
    )
  );
}
export async function POST(req: NextRequest) {
  const contentLength = req.headers.get("content-length");
  const hasBody = contentLength !== null && contentLength !== "0";
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    if (req.headers.get("content-type") || hasBody) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;
  const scriptIds = input.script_ids;
  if (scriptIds !== undefined && !isPositiveIntegerArray(scriptIds)) {
    return NextResponse.json(
      { error: "script_ids must be an array of positive integers" },
      { status: 400 }
    );
  }

  try {
    const result = await crawlAll(scriptIds);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawl failed";
    if (message.includes("missing or inactive")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw error;
  }
}