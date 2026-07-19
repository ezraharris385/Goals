import { useState } from "react";
import { friendlyError, importGoals } from "../ai";
import { useStore } from "../store";
import { Domain, DOMAIN_META, DOMAINS, Timeframe, TIMEFRAMES, uid } from "../types";

export function GoalsView() {
  const { data, update } = useStore();
  const [tf, setTf] = useState<Timeframe | "all">("all");
  const [dom, setDom] = useState<Domain | "all">("all");
  const [showDump, setShowDump] = useState(false);
  const [dumpText, setDumpText] = useState("");
  const [dumpBusy, setDumpBusy] = useState(false);
  const [dumpMsg, setDumpMsg] = useState("");

  const runDump = async () => {
    if (!dumpText.trim()) return;
    if (!data.settings.apiKey) {
      setDumpMsg("Add your API key in Setup first.");
      return;
    }
    setDumpBusy(true);
    setDumpMsg("");
    try {
      const goals = await importGoals(data.settings.apiKey, dumpText, data);
      if (!goals.length) {
        setDumpMsg("Couldn't find any goals in that — try writing them more directly.");
      } else {
        update((d) => ({
          ...d,
          goals: [
            ...d.goals,
            ...goals.map((g) => ({
              id: uid(),
              domain: g.domain,
              timeframe: g.timeframe,
              title: g.title,
              why: g.why,
              metric: g.metric,
              target: g.target,
              deadline: g.deadline,
              progress: 0,
              status: "active" as const,
              createdAt: new Date().toISOString(),
            })),
          ],
        }));
        setDumpText("");
        setShowDump(false);
        setDumpMsg("");
      }
    } catch (e) {
      setDumpMsg(friendlyError(e));
    } finally {
      setDumpBusy(false);
    }
  };

  const goals = data.goals
    .filter((g) => g.status !== "archived")
    .filter((g) => tf === "all" || g.timeframe === tf)
    .filter((g) => dom === "all" || g.domain === dom)
    .sort((a, b) => a.progress - b.progress);

  const bump = (id: string, delta: number) =>
    update((d) => {
      const g = d.goals.find((x) => x.id === id);
      if (g) {
        g.progress = Math.max(0, Math.min(100, g.progress + delta));
        if (g.progress >= 100) g.status = "completed";
        else g.status = "active";
      }
      return d;
    });

  const complete = (id: string) =>
    update((d) => {
      const g = d.goals.find((x) => x.id === id);
      if (g) {
        g.progress = 100;
        g.status = "completed";
      }
      return d;
    });

  return (
    <div className="screen">
      <div className="brand">The Board</div>
      <h1 className="title">Goals</h1>
      <div className="subtitle">Every front. Every horizon.</div>

      <button className="big-btn" onClick={() => setShowDump(true)}>
        🧠 Brain dump — paste all your goals at once
      </button>

      {showDump && (
        <div className="modal-backdrop" onClick={() => !dumpBusy && setShowDump(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 10 }}>Brain Dump</h3>
            <div className="hint" style={{ marginBottom: 10 }}>
              Write everything you want to achieve — messy is fine. The AI will split
              it into clean goals, sort them into Health / Personal / Professional,
              and set timeframes.
            </div>
            <textarea
              className="text-input"
              rows={7}
              placeholder={"e.g. run a sub-4 marathon next spring, get promoted to senior by December, read 20 books this year, call my parents weekly, bench 225…"}
              value={dumpText}
              onChange={(e) => setDumpText(e.target.value)}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
            {dumpMsg && <div className="error-banner" style={{ marginTop: 10 }}>{dumpMsg}</div>}
            <button
              className="big-btn"
              style={{ marginTop: 12 }}
              disabled={dumpBusy || !dumpText.trim()}
              onClick={runDump}
            >
              {dumpBusy ? "Sorting your goals…" : "Extract & file my goals"}
            </button>
            <button
              className="big-btn secondary"
              style={{ marginBottom: 0 }}
              disabled={dumpBusy}
              onClick={() => setShowDump(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="pill-row">
        <button
          className={`pill ${tf === "all" ? "active" : ""}`}
          onClick={() => setTf("all")}
        >
          All
        </button>
        {TIMEFRAMES.map((t) => (
          <button
            key={t.key}
            className={`pill ${tf === t.key ? "active" : ""}`}
            onClick={() => setTf(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pill-row">
        <button
          className={`pill ${dom === "all" ? "active" : ""}`}
          onClick={() => setDom("all")}
        >
          All fronts
        </button>
        {DOMAINS.map((d) => (
          <button
            key={d}
            className={`pill ${dom === d ? "domain-active" : ""}`}
            style={dom === d ? { background: DOMAIN_META[d].color } : {}}
            onClick={() => setDom(d)}
          >
            {DOMAIN_META[d].emoji} {DOMAIN_META[d].label}
          </button>
        ))}
      </div>

      {goals.length === 0 ? (
        <div className="empty">
          <div className="big">🎯</div>
          Nothing here yet. Drop your goals on a coach in the Coaches tab — they'll
          sharpen them and file them for you.
        </div>
      ) : (
        goals.map((g) => {
          const meta = DOMAIN_META[g.domain];
          const done = g.status === "completed";
          return (
            <div
              className="goal-card"
              key={g.id}
              style={{ borderLeftColor: meta.color, opacity: done ? 0.65 : 1 }}
            >
              <div className="goal-top">
                <div className="goal-title">
                  {done ? "✅ " : ""}
                  {g.title}
                </div>
                <div className="goal-pct" style={{ color: meta.color }}>
                  {g.progress}%
                </div>
              </div>
              <div className="goal-meta">
                {meta.emoji} {meta.label} ·{" "}
                {TIMEFRAMES.find((t) => t.key === g.timeframe)?.label}
                {g.deadline ? ` · due ${g.deadline}` : ""}
                {g.metric ? ` · ${g.metric}` : ""}
                {g.target ? ` → ${g.target}` : ""}
              </div>
              <div className="bar">
                <div
                  className="bar-fill"
                  style={{ width: `${g.progress}%`, background: meta.color }}
                />
              </div>
              {!done && (
                <div className="goal-actions">
                  <button className="mini-btn" onClick={() => bump(g.id, -10)}>
                    −10%
                  </button>
                  <button className="mini-btn" onClick={() => bump(g.id, 10)}>
                    +10%
                  </button>
                  <button className="mini-btn" onClick={() => complete(g.id)}>
                    Done ✓
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
