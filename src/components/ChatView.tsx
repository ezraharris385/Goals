import { useEffect, useRef, useState } from "react";
import { buildBlueprint, friendlyError, sendChat } from "../ai";
import { makeToolActions } from "../actions";
import { useStore } from "../store";
import { Domain, DOMAIN_META, DOMAINS, PendingGoal, uid } from "../types";
import { PendingReview } from "./PendingReview";

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
  const [showBp, setShowBp] = useState(false);
  const [bpOutcome, setBpOutcome] = useState("");
  const [bpDate, setBpDate] = useState("");
  const [bpCurrent, setBpCurrent] = useState("");
  const [bpBusy, setBpBusy] = useState(false);
  const [bpMsg, setBpMsg] = useState("");
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

  const runBlueprint = async () => {
    if (!bpOutcome.trim()) return;
    if (!data.settings.apiKey) {
      setBpMsg("Add your API key in Setup first.");
      return;
    }
    setBpBusy(true);
    setBpMsg("");
    try {
      const bp = await buildBlueprint(
        data.settings.apiKey,
        domain,
        {
          outcome: bpOutcome.trim(),
          targetDate: bpDate || undefined,
          current: bpCurrent.trim() || undefined,
        },
        data
      );
      const proposed: PendingGoal[] = [
        {
          id: uid(),
          domain,
          timeframe: "long_term",
          title: bp.outcome.title,
          why: bp.outcome.why,
          metric: bp.outcome.metric,
          target: bp.outcome.target,
          deadline: bp.outcome.deadline,
        },
        ...bp.milestones.map((m) => ({
          id: uid(),
          domain,
          timeframe: "short_term" as const,
          title: m.title,
          why: `Milestone toward: ${bp.outcome.title}`,
          metric: m.metric,
          target: m.target,
          deadline: m.deadline,
        })),
        ...bp.routines.map((r) => ({
          id: uid(),
          domain,
          timeframe: r.timeframe,
          title: r.title,
          why: `Compounds toward: ${bp.outcome.title}`,
          metric: r.metric,
        })),
      ];
      update((d) => {
        d.pending = [...d.pending, ...proposed];
        d.chats[domain] = [
          ...(d.chats[domain] ?? []),
          {
            role: "assistant",
            content: `🏔 BLUEPRINT: ${bp.outcome.title} — by ${bp.outcome.deadline}\n\n${bp.summary}\n\nI've drafted the path: the summit goal, ${bp.milestones.length} milestone${bp.milestones.length === 1 ? "" : "s"} with staged deadlines${bp.milestones.length ? ` (first: "${bp.milestones[0].title}" by ${bp.milestones[0].deadline})` : ""}, and ${bp.routines.length} routine${bp.routines.length === 1 ? "" : "s"}. Review the card below, check what you want, and confirm — then report to me as you knock them down.`,
            at: new Date().toISOString(),
          },
        ];
        return d;
      });
      setShowBp(false);
      setBpOutcome("");
      setBpDate("");
      setBpCurrent("");
    } catch (e) {
      setBpMsg(friendlyError(e));
    } finally {
      setBpBusy(false);
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

      <button
        className="bp-btn"
        style={{ borderColor: `${meta.color}55`, color: meta.color }}
        onClick={() => setShowBp(true)}
      >
        🏔 Blueprint a big outcome with {meta.agent}
      </button>

      {error && <div className="error-banner">{error}</div>}

      <PendingReview />

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

      {showBp && (
        <div className="modal-backdrop" onClick={() => !bpBusy && setShowBp(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 6 }}>🏔 Blueprint with {meta.agent}</h3>
            <div className="hint" style={{ marginBottom: 4 }}>
              Give {meta.agent} a big, broad outcome — not a normal goal. It'll
              analyze what it takes and file the full path: the summit goal, staged
              milestones with deadlines, and the routines that compound toward it.
            </div>
            <div className="field-label">The outcome</div>
            <textarea
              className="text-input"
              rows={3}
              placeholder={
                domain === "health"
                  ? "e.g. run a 100-mile ultra, get to 12% body fat and stay there"
                  : domain === "professional"
                    ? "e.g. make senior engineer, grow my side business to $5k/mo"
                    : "e.g. become fluent in Spanish, buy a house"
              }
              value={bpOutcome}
              onChange={(e) => setBpOutcome(e.target.value)}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
            <div className="form-grid">
              <div>
                <div className="field-label">Target date (optional)</div>
                <input
                  className="text-input"
                  type="date"
                  value={bpDate}
                  onChange={(e) => setBpDate(e.target.value)}
                />
              </div>
              <div>
                <div className="field-label">Where you are now (optional)</div>
                <input
                  className="text-input"
                  placeholder="e.g. can run 10k today"
                  value={bpCurrent}
                  onChange={(e) => setBpCurrent(e.target.value)}
                />
              </div>
            </div>
            {bpMsg && <div className="error-banner" style={{ marginTop: 10 }}>{bpMsg}</div>}
            <button
              className="big-btn"
              style={{ marginTop: 14 }}
              disabled={bpBusy || !bpOutcome.trim()}
              onClick={runBlueprint}
            >
              {bpBusy ? `${meta.agent} is mapping the path…` : "Analyze & build the path →"}
            </button>
            <button
              className="big-btn secondary"
              style={{ marginBottom: 0 }}
              disabled={bpBusy}
              onClick={() => setShowBp(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
