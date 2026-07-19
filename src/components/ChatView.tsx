import { useEffect, useRef, useState } from "react";
import { friendlyError, sendChat } from "../ai";
import { makeToolActions } from "../actions";
import { useStore } from "../store";
import { Domain, DOMAIN_META, DOMAINS } from "../types";

const INTROS: Record<Domain, string> = {
  health:
    "IRON here. Body, training, sleep, fuel. Tell me what you're chasing — a lift number, a race, a weight, energy that doesn't quit at 2pm. Give me the goal and I'll make it real: metric, target, deadline. Then we go to work.",
  personal:
    "I'm NORTH. Character, relationships, money, habits — the person you are when nobody's grading you. What do you want your life to look like? Say it plainly and I'll turn it into goals we can actually hold you to.",
  professional:
    "CLIMB. Career, skills, output, income. Where are you now, and where should you be that you're not? Give me your ambitions — I'll sharpen them into targets with deadlines and we'll start stacking wins.",
};

export function ChatView() {
  const { data, update } = useStore();
  const [domain, setDomain] = useState<Domain>("health");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = data.chats[domain] ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy, domain]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!data.settings.apiKey) {
      setError("Add your Anthropic API key in Settings first.");
      return;
    }
    setError("");
    setInput("");
    const at = new Date().toISOString();
    update((d) => {
      d.chats[domain] = [...(d.chats[domain] ?? []), { role: "user", content: text, at }];
      return d;
    });
    setBusy(true);
    try {
      const reply = await sendChat(
        data.settings.apiKey,
        domain,
        messages,
        text,
        data,
        makeToolActions(domain, update)
      );
      update((d) => {
        d.chats[domain] = [
          ...(d.chats[domain] ?? []),
          { role: "assistant", content: reply, at: new Date().toISOString() },
        ];
        return d;
      });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const meta = DOMAIN_META[domain];

  return (
    <div className="screen" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 140px)" }}>
      <div className="brand">Your Corner</div>
      <h1 className="title">Coaches</h1>
      <div className="subtitle">Drop goals. Report work. Get pushed.</div>

      <div className="agent-row">
        {DOMAINS.map((d) => {
          const m = DOMAIN_META[d];
          const active = d === domain;
          return (
            <button
              key={d}
              className={`agent-chip ${active ? "active" : ""}`}
              style={active ? { borderColor: m.color, background: `${m.color}18` } : {}}
              onClick={() => setDomain(d)}
            >
              <span style={{ fontSize: 20 }}>{m.emoji}</span>
              <span className="a-name" style={active ? { color: m.color } : {}}>
                {m.agent}
              </span>
              <span className="a-domain">{m.label}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="chat-scroll">
        {messages.length === 0 && (
          <div className="msg assistant">{INTROS[domain]}</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="typing" style={{ color: meta.color }}>
            {meta.agent} is thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <input
          className="chat-input"
          placeholder={`Talk to ${meta.agent}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={busy}
        />
        <button className="send-btn" onClick={send} disabled={busy || !input.trim()}>
          ↑
        </button>
      </div>
    </div>
  );
}
