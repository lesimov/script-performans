import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { normalizeCrawlData, Script, Snapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

type ChatMessage = { role: "user" | "assistant"; content: string };

type SnapshotRow = Snapshot & { script_id: number };

const requestTimes = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (requestTimes.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT) {
    requestTimes.set(key, recent);
    return true;
  }
  recent.push(now);
  requestTimes.set(key, recent);
  return false;
}


function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  if (!("role" in value) || !("content" in value)) return false;
  return (
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    value.content.length <= 4000
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI is not configured. Add OPENROUTER_API_KEY in Railway variables." },
      { status: 503 }
    );
  }
  const requester = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(requester)) {
    return NextResponse.json({ error: "AI rate limit reached. Try again shortly." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const messages = (body as Record<string, unknown>).messages;
  const validMessages = Array.isArray(messages)
    ? messages.filter(isChatMessage)
    : [];
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 20 ||
    validMessages.length !== messages.length
  ) {
    return NextResponse.json({ error: "messages must contain 1-20 valid messages" }, { status: 400 });
  }

  const scripts = await query<Script>(
    `SELECT id, name, slug, url, script_type, is_active, created_at, updated_at
     FROM scripts WHERE is_active = TRUE ORDER BY script_type, name`
  );
  const snapshots = await query<SnapshotRow>(
    `SELECT id, script_id, date, raw_data, created_at
     FROM snapshots
     WHERE date >= CURRENT_DATE - INTERVAL '90 days'
     ORDER BY date DESC`
  );

  const context = scripts.map((script) => ({
    id: script.id,
    name: script.name,
    type: script.script_type,
    snapshots: snapshots
      .slice(0, 90)
      .map((snapshot) => ({
        date: String(snapshot.date).slice(0, 10),
        ...normalizeCrawlData(snapshot.raw_data),
      })),
  }));

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://script-performans-production.up.railway.app",
      "X-Title": "Script Pulse",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are Script Pulse, a concise performance analyst. Answer in Turkish unless the user writes in another language. Use only the supplied dashboard data. Structure answers with short headings, metric bullets, trend direction, dates, and explicit limitations. Never invent missing values.",
        },
        {
          role: "system",
          content: `Dashboard context (owned and competitor scripts, last 90 days): ${JSON.stringify(context)}`,
        },
        ...validMessages,
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!upstream.ok) {
    return NextResponse.json(
      { error: payload.error?.message || "OpenRouter request failed" },
      { status: 502 }
    );
  }

  const answer = payload.choices?.[0]?.message?.content;
  if (!answer) {
    return NextResponse.json({ error: "AI returned an empty response" }, { status: 502 });
  }

  return NextResponse.json({ answer, model: MODEL });
}
