import { useState } from "react";
import { useStore } from "../store";
import {
  Domain,
  DOMAIN_META,
  DOMAINS,
  pendingToGoal,
  Timeframe,
  TIMEFRAMES,
} from "../types";

// Shown wherever AI-proposed goals await the user's approval.
export function PendingReview() {
  const { data, update } = useStore();
  const [off, setOff] = useState<Set<string>>(new Set());

  if (data.pending.length === 0) return null;

  const toggle = (id: string) =>
    setOff((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const setField = (id: string, field: "domain" | "timeframe", value: string) =>
    update((d) => {
      const p = d.pending.find((x) => x.id === id);
      if (p) (p as any)[field] = value;
      return d;
    });

  const keepIds = data.pending.filter((p) => !off.has(p.id)).map((p) => p.id);

  const confirm = () => {
    update((d) => {
      const keep = d.pending.filter((p) => keepIds.includes(p.id));
      return {
        ...d,
        goals: [...d.goals, ...keep.map(pendingToGoal)],
        pending: [],
      };
    });
    setOff(new Set());
  };

  const discardAll = () => {
    if (!window.confirm("Discard all proposed goals? None will be added.")) return;
    update((d) => ({ ...d, pending: [] }));
    setOff(new Set());
  };

  return (
    <div className="card review-card">
      <h3 style={{ color: "var(--accent)" }}>
        ✎ Review {data.pending.length} proposed goal
        {data.pending.length === 1 ? "" : "s"}
      </h3>
      <div className="hint" style={{ marginBottom: 12 }}>
        Your coach lined these up. Check the ones to keep, fix the category if needed,
        then add them. Nothing is saved until you confirm.
      </div>

      {data.pending.map((p) => {
        const on = !off.has(p.id);
        const meta = DOMAIN_META[p.domain];
        return (
          <div className={`review-item ${on ? "" : "muted"}`} key={p.id}>
            <button
              className={`action-check ${on ? "done" : ""}`}
              onClick={() => toggle(p.id)}
              aria-label={on ? "Keep" : "Skip"}
            >
              {on ? "✓" : ""}
            </button>
            <div style={{ flex: 1 }}>
              <div className="review-title">{p.title}</div>
              {(p.metric || p.target || p.deadline) && (
                <div className="action-meta">
                  {p.metric ?? ""}
                  {p.target ? ` → ${p.target}` : ""}
                  {p.deadline ? ` · due ${p.deadline}` : ""}
                </div>
              )}
              <div className="review-selects">
                <select
                  value={p.domain}
                  onChange={(e) => setField(p.id, "domain", e.target.value as Domain)}
                  style={{ color: meta.color }}
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {DOMAIN_META[d].emoji} {DOMAIN_META[d].label}
                    </option>
                  ))}
                </select>
                <select
                  value={p.timeframe}
                  onChange={(e) =>
                    setField(p.id, "timeframe", e.target.value as Timeframe)
                  }
                >
                  {TIMEFRAMES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      })}

      <button
        className="big-btn"
        style={{ marginTop: 12 }}
        disabled={keepIds.length === 0}
        onClick={confirm}
      >
        {keepIds.length === 0
          ? "Check at least one to add"
          : `Add ${keepIds.length} goal${keepIds.length === 1 ? "" : "s"} to my board`}
      </button>
      <button
        className="big-btn secondary"
        style={{ marginBottom: 0 }}
        onClick={discardAll}
      >
        Discard all
      </button>
    </div>
  );
}
