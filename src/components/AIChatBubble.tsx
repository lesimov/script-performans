"use client";

import { FormEvent, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const STARTER_PROMPTS = [
  "Son 7 günde hangi script yükseldi?",
  "En çok düşüş yaşayan script hangisi?",
  "Rakiplerle aramızdaki farkı özetle.",
];

export default function AIChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "AI response failed");
      }
      setMessages([...nextMessages, { role: "assistant", content: payload.answer }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI response failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-chat-title"
          className="fixed inset-x-4 bottom-24 z-50 flex max-h-[min(720px,calc(100vh-7rem))] flex-col overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950/95 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[min(420px,calc(100vw-3rem))]"
        >
          <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Script Pulse AI</p>
              <h2 id="ai-chat-title" className="mt-1 font-bold text-white">Ask about performance</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close AI assistant">×</button>
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-sm leading-6 text-slate-400">I can analyze owned and competitor script trends from your dashboard data.</p>
                <div className="mt-4 space-y-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => setInput(prompt)} className="block w-full rounded-xl border border-slate-800 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-400/5">{prompt}</button>
                  ))}
                </div>
              </div>
            ) : messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "ml-8 bg-cyan-400/10 text-cyan-100" : "mr-4 border border-slate-800 bg-slate-900 text-slate-200"}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            {loading && <div className="mr-4 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-500">Analyzing dashboard data…</div>}
            {error && <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">{error}</p>}
          </div>
          <form onSubmit={send} className="border-t border-slate-800 p-3">
            <label htmlFor="ai-chat-input" className="sr-only">Ask about your scripts</label>
            <div className="flex gap-2">
              <input id="ai-chat-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your scripts…" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" />
              <button type="submit" disabled={loading || !input.trim()} className="rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 disabled:opacity-40">Send</button>
            </div>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-emerald-400 text-sm font-black text-slate-950 shadow-xl shadow-cyan-950/50 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950" aria-label={open ? "Close AI assistant" : "Open AI assistant"}>{open ? "×" : "AI"}</button>
    </>
  );
}
