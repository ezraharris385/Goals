import { useState } from "react";
import { friendlyError, importGoals } from "../ai";
import { useStore } from "../store";
import {
  daysUntil,
  Domain,
  DOMAIN_META,
  DOMAINS,
  EventItem,
  Goal,
  goalPace,
  isRoutine,
  PendingGoal,
  Timeframe,
  TIMEFRAMES,
  todayISO,
  uid,
} from "../types";
import { PendingReview } from "./PendingReview";

const PACE_STYLE: Record<string, { label: string; color: string }> = {
  ahead: { label: "▲ Ahead", color: "var(--health)" },
  on_track: { label: "● On track", color: "var(--text-dim)" },
  behind: { label: "▼ Behind", color: "var(--danger)" },
};

function fmtEventDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function GoalsView() {
  const { data, update } = useStore();
  const [view, setView] = useState<"goals" | "events">("goals");
  const [tf, setTf] = useState<Timeframe | "all">("all");
  const [dom, setDom] = useState<Domain | "all">("all");
  const [showDump, setShowDump] = useState(false);
  const [dumpText, setDumpText] = useState("");
  const [dumpBusy, setDumpBusy] = useState(false);
  const [dumpMsg, setDumpMsg] = useState("");
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editEvent, setEditEvent] = useState<EventItem | null>(null);

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
        const proposed: PendingGoal[] = goals.map((g) => ({
          id: uid(),
          domain: g.domain,
          timeframe: g.timeframe,
          title: g.title,
          why: g.why,
          metric: g.metric,
          target: g.target,
          deadline: g.deadline,
        }));
        update((d) => ({ ...d, pending: [...d.pending, ...proposed] }));
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
        g.status = g.progress >= 100 ? "completed" : "active";
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

  const saveGoalEdit = () => {
    if (!editGoal) return;
    update((d) => {
      const i = d.goals.findIndex((x) => x.id === editGoal.id);
      if (i >= 0) d.goals[i] = { ...editGoal };
      return d;
    });
    setEditGoal(null);
  };

  const deleteGoal = () => {
    if (!editGoal) return;
    if (!confirm(`Delete "${editGoal.title}"? This can't be undone.`)) return;
    update((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== editGoal.id) }));
    setEditGoal(null);
  };

  const toggleEventDone = (id: string) =>
    update((d) => {
      const e = d.events.find((x) => x.id === id);
      if (e) e.done = !e.done;
      return d;
    });

  const saveEventEdit = () => {
    if (!editEvent || !editEvent.title.trim() || !editEvent.date) return;
    update((d) => {
      const i = d.events.findIndex((x) => x.id === editEvent.id);
      if (i >= 0) d.events[i] = { ...editEvent };
      else d.events.push({ ...editEvent });
      return d;
    });
    setEditEvent(null);
  };

  const deleteEvent = () => {
    if (!editEvent) return;
    if (!confirm(`Delete "${editEvent.title}"?`)) return;
    update((d) => ({ ...d, events: d.events.filter((e) => e.id !== editEvent.id) }));
    setEditEvent(null);
  };

  const upcoming = data.events
    .filter((e) => !e.done && daysUntil(e.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"));
  const pastOrDone = data.events
    .filter((e) => e.done || daysUntil(e.date) < 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="screen">
      <div className="brand">The Board</div>
      <h1 className="title">Goals</h1>
      <div className="subtitle">Every front. Every horizon.</div>

      <div className="seg-row">
        <button
          className={`seg ${view === "goals" ? "active" : ""}`}
          onClick={() => setView("goals")}
        >
          🎯 Goals
        </button>
        <button
          className={`seg ${view === "events" ? "active" : ""}`}
          onClick={() => setView("events")}
        >
          📅 Upcoming
        </button>
      </div>

      <PendingReview />

      {view === "goals" && (
        <>
          <button className="big-btn" onClick={() => setShowDump(true)}>
            🧠 Brain dump — paste all your goals at once
          </button>

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
              Nothing here yet. Brain dump above, or talk to your coaches — they'll
              sharpen your goals and file them for you.
            </div>
          ) : (
            goals.map((g) => {
              const meta = DOMAIN_META[g.domain];
              const done = g.status === "completed";
              const pace = goalPace(g);
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
                    {g.metric ? ` · ${g.metric}` : ""}
                    {g.target ? ` → ${g.target}` : ""}
                  </div>
                  <div className="badge-row">
                    <span className="badge">{isRoutine(g) ? "🔁 Routine" : "📌 Dated"}</span>
                    {g.deadline && !done && (
                      <span className="badge">
                        due {g.deadline} ({daysUntil(g.deadline)}d)
                      </span>
                    )}
                    {pace && !done && (
                      <span className="badge" style={{ color: PACE_STYLE[pace.label].color }}>
                        {PACE_STYLE[pace.label].label} · should be ~{pace.expected}%
                      </span>
                    )}
                  </div>
                  <div className="bar">
                    <div
                      className="bar-fill"
                      style={{ width: `${g.progress}%`, background: meta.color }}
                    />
                  </div>
                  <div className="goal-actions">
                    <button className="mini-btn" onClick={() => setEditGoal({ ...g })}>
                      ✎ Edit
                    </button>
                    {!done && (
                      <>
                        <button className="mini-btn" onClick={() => bump(g.id, 10)}>
                          +10%
                        </button>
                        <button className="mini-btn" onClick={() => complete(g.id)}>
                          Done ✓
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {view === "events" && (
        <>
          <button
            className="big-btn"
            onClick={() =>
              setEditEvent({
                id: uid(),
                title: "",
                date: todayISO(),
                domain: "personal",
                done: false,
              })
            }
          >
            ＋ Add an upcoming event
          </button>
          <div className="hint" style={{ marginBottom: 14 }}>
            Date-specific things to look out for — interviews, races, launches,
            deadlines. Not everyday goals. Your coaches can add these from chat too.
          </div>

          {upcoming.length === 0 && pastOrDone.length === 0 && (
            <div className="empty">
              <div className="big">📅</div>
              Nothing on the radar. Add events here, or mention them to a coach —
              "I have an interview on the 28th" gets filed automatically.
            </div>
          )}

          {upcoming.map((e) => {
            const meta = DOMAIN_META[e.domain];
            const days = daysUntil(e.date);
            return (
              <div className="event-card" key={e.id} style={{ borderLeftColor: meta.color }}>
                <div className="event-days" style={{ color: days <= 3 ? "var(--danger)" : meta.color }}>
                  {days === 0 ? "TODAY" : days === 1 ? "1 day" : `${days} days`}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="action-text">{e.title}</div>
                  <div className="action-meta">
                    {fmtEventDate(e.date)}
                    {e.time ? ` · ${e.time}` : ""} · {meta.emoji} {meta.label}
                    {e.notes ? ` — ${e.notes}` : ""}
                  </div>
                </div>
                <div className="event-btns">
                  <button className="mini-btn" onClick={() => setEditEvent({ ...e })}>
                    ✎
                  </button>
                  <button className="mini-btn" onClick={() => toggleEventDone(e.id)}>
                    ✓
                  </button>
                </div>
              </div>
            );
          })}

          {pastOrDone.length > 0 && (
            <>
              <div className="date-header" style={{ color: "var(--text-dim)" }}>
                Past / done
              </div>
              {pastOrDone.slice(0, 10).map((e) => (
                <div className="event-card done-row" key={e.id} style={{ opacity: 0.55 }}>
                  <div style={{ flex: 1 }}>
                    <div className="action-text" style={{ textDecoration: e.done ? "line-through" : "none" }}>
                      {e.title}
                    </div>
                    <div className="action-meta">{fmtEventDate(e.date)}</div>
                  </div>
                  <div className="event-btns">
                    <button className="mini-btn" onClick={() => setEditEvent({ ...e })}>
                      ✎
                    </button>
                    {!e.done && (
                      <button className="mini-btn" onClick={() => toggleEventDone(e.id)}>
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

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

      {editGoal && (
        <div className="modal-backdrop" onClick={() => setEditGoal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 6 }}>Edit Goal</h3>
            <div className="field-label">Title</div>
            <input
              className="text-input"
              value={editGoal.title}
              onChange={(e) => setEditGoal({ ...editGoal, title: e.target.value })}
            />
            <div className="form-grid">
              <div>
                <div className="field-label">Front</div>
                <select
                  className="text-input"
                  value={editGoal.domain}
                  onChange={(e) =>
                    setEditGoal({ ...editGoal, domain: e.target.value as Domain })
                  }
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {DOMAIN_META[d].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="field-label">Timeframe</div>
                <select
                  className="text-input"
                  value={editGoal.timeframe}
                  onChange={(e) =>
                    setEditGoal({ ...editGoal, timeframe: e.target.value as Timeframe })
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
            <div className="field-label">Metric (how it's measured)</div>
            <input
              className="text-input"
              value={editGoal.metric ?? ""}
              onChange={(e) => setEditGoal({ ...editGoal, metric: e.target.value })}
            />
            <div className="form-grid">
              <div>
                <div className="field-label">Target</div>
                <input
                  className="text-input"
                  value={editGoal.target ?? ""}
                  onChange={(e) => setEditGoal({ ...editGoal, target: e.target.value })}
                />
              </div>
              <div>
                <div className="field-label">Deadline</div>
                <input
                  className="text-input"
                  type="date"
                  value={editGoal.deadline ?? ""}
                  onChange={(e) =>
                    setEditGoal({ ...editGoal, deadline: e.target.value || undefined })
                  }
                />
              </div>
            </div>
            <div className="field-label">Progress: {editGoal.progress}%</div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={editGoal.progress}
              onChange={(e) => {
                const p = Number(e.target.value);
                setEditGoal({
                  ...editGoal,
                  progress: p,
                  status: p >= 100 ? "completed" : "active",
                });
              }}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
            <button className="big-btn" style={{ marginTop: 14 }} onClick={saveGoalEdit}>
              Save changes
            </button>
            <button
              className="big-btn secondary"
              style={{ color: "var(--danger)", borderColor: "rgba(248,113,113,0.4)" }}
              onClick={deleteGoal}
            >
              Delete goal
            </button>
            <button
              className="big-btn secondary"
              style={{ marginBottom: 0 }}
              onClick={() => setEditGoal(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editEvent && (
        <div className="modal-backdrop" onClick={() => setEditEvent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 6 }}>
              {data.events.some((x) => x.id === editEvent.id) ? "Edit Event" : "New Event"}
            </h3>
            <div className="field-label">What's happening</div>
            <input
              className="text-input"
              placeholder="e.g. Final interview with Acme"
              value={editEvent.title}
              onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })}
            />
            <div className="form-grid">
              <div>
                <div className="field-label">Date</div>
                <input
                  className="text-input"
                  type="date"
                  value={editEvent.date}
                  onChange={(e) => setEditEvent({ ...editEvent, date: e.target.value })}
                />
              </div>
              <div>
                <div className="field-label">Time (optional)</div>
                <input
                  className="text-input"
                  type="time"
                  value={editEvent.time ?? ""}
                  onChange={(e) =>
                    setEditEvent({ ...editEvent, time: e.target.value || undefined })
                  }
                />
              </div>
            </div>
            <div className="field-label">Front</div>
            <select
              className="text-input"
              value={editEvent.domain}
              onChange={(e) =>
                setEditEvent({ ...editEvent, domain: e.target.value as Domain })
              }
            >
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_META[d].label}
                </option>
              ))}
            </select>
            <div className="field-label">Notes / what to prep (optional)</div>
            <input
              className="text-input"
              value={editEvent.notes ?? ""}
              onChange={(e) => setEditEvent({ ...editEvent, notes: e.target.value })}
            />
            <button
              className="big-btn"
              style={{ marginTop: 14 }}
              disabled={!editEvent.title.trim() || !editEvent.date}
              onClick={saveEventEdit}
            >
              Save event
            </button>
            {data.events.some((x) => x.id === editEvent.id) && (
              <button
                className="big-btn secondary"
                style={{ color: "var(--danger)", borderColor: "rgba(248,113,113,0.4)" }}
                onClick={deleteEvent}
              >
                Delete event
              </button>
            )}
            <button
              className="big-btn secondary"
              style={{ marginBottom: 0 }}
              onClick={() => setEditEvent(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
