import { useState } from "react";
import { friendlyError, generatePlan, Intensity } from "../ai";
import { useStore } from "../store";
import {
  ActionItem,
  Bucket,
  BUCKET_META,
  daysUntil,
  Domain,
  DOMAIN_META,
  DOMAINS,
  itemBucket,
  itemUrgency,
  sortItems,
  uid,
  URGENCY_META,
} from "../types";

const INTENSITIES: { key: Intensity; label: string; desc: string }[] = [
  { key: "steady", label: "Steady", desc: "Sustainable, disciplined pace" },
  { key: "push", label: "Push", desc: "Demanding — includes stretch work" },
  { key: "max", label: "Max", desc: "Peak output. Pack the day." },
];

const BUCKETS: Bucket[] = ["must_do", "routine", "long_term"];

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function ItemRow({
  it,
  onToggle,
}: {
  it: ActionItem;
  onToggle: () => void;
}) {
  const urg = URGENCY_META[itemUrgency(it)];
  return (
    <div className={`action ${it.done ? "done-row" : ""}`}>
      <button className={`action-check ${it.done ? "done" : ""}`} onClick={onToggle}>
        {it.done ? "✓" : ""}
      </button>
      <div>
        <div className="action-text">
          {urg.label && !it.done && (
            <span className="urg-tag" style={{ color: urg.color, borderColor: urg.color }}>
              {urg.label}
            </span>
          )}
          {it.text}
        </div>
        <div className="action-meta" style={{ color: DOMAIN_META[it.domain].color }}>
          {DOMAIN_META[it.domain].emoji} {DOMAIN_META[it.domain].label}
        </div>
      </div>
    </div>
  );
}

export function PlanView() {
  const { data, update } = useStore();
  const [busy, setBusy] = useState<"daily" | "weekly" | null>(null);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<"daily" | "weekly" | null>(null);
  const [focus, setFocus] = useState("");
  const [intensity, setIntensity] = useState<Intensity>("push");
  const [dom, setDom] = useState<Domain | "all">("all");

  const openSetup = (scope: "daily" | "weekly") => {
    if (!data.settings.apiKey) {
      setError("Add your Anthropic API key in Settings first.");
      return;
    }
    if (data.goals.filter((g) => g.status === "active").length === 0) {
      setError("No active goals. Give your coaches something to work with first.");
      return;
    }
    setError("");
    setFocus("");
    setSetup(scope);
  };

  const run = async (scope: "daily" | "weekly") => {
    setSetup(null);
    setBusy(scope);
    setError("");
    try {
      const plan = await generatePlan(data.settings.apiKey, scope, data, {
        focus: focus.trim() || undefined,
        intensity,
      });
      const items: ActionItem[] = plan.items.map((it) => ({
        id: uid(),
        text: it.text,
        date: it.date,
        domain: it.domain,
        goalId: it.goal_id,
        bucket: it.bucket,
        urgency: it.urgency,
        done: false,
      }));
      update((d) => ({
        ...d,
        plans: {
          ...d.plans,
          [scope]: {
            scope,
            generatedAt: new Date().toISOString(),
            focus: plan.focus,
            items,
          },
        },
        assessment: {
          doingWell: plan.doingWell,
          needsWork: plan.needsWork,
          pushMessage: plan.pushMessage,
          updatedAt: new Date().toISOString(),
        },
      }));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const toggle = (scope: "daily" | "weekly", id: string) =>
    update((d) => {
      const it = d.plans[scope]?.items.find((x) => x.id === id);
      if (it) it.done = !it.done;
      return d;
    });

  const filterItems = (items: ActionItem[]) =>
    items.filter((i) => dom === "all" || i.domain === dom);

  const renderDaily = () => {
    const plan = data.plans.daily;
    if (!plan) return null;
    const items = filterItems(plan.items);
    return (
      <div className="card" key="daily">
        <h3>Today's Plan · {plan.focus}</h3>
        {BUCKETS.map((b) => {
          const list = items.filter((i) => itemBucket(i) === b).sort(sortItems);
          if (!list.length) return null;
          return (
            <div key={b}>
              <div className="bucket-header">
                {BUCKET_META[b].emoji} {BUCKET_META[b].label}
              </div>
              {list.map((it) => (
                <ItemRow key={it.id} it={it} onToggle={() => toggle("daily", it.id)} />
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekly = () => {
    const plan = data.plans.weekly;
    if (!plan) return null;
    const items = filterItems(plan.items);
    const byDate = new Map<string, ActionItem[]>();
    for (const it of items) byDate.set(it.date, [...(byDate.get(it.date) ?? []), it]);
    const dates = [...byDate.keys()].sort();
    return (
      <div className="card" key="weekly">
        <h3>This Week · {plan.focus}</h3>
        {dates.map((date) => (
          <div key={date}>
            <div className="date-header">{fmtDate(date)}</div>
            {byDate
              .get(date)!
              .sort(sortItems)
              .map((it) => {
                const b = itemBucket(it);
                return (
                  <div key={it.id} style={{ display: "flex", alignItems: "flex-start" }}>
                    <span className="bucket-dot" title={BUCKET_META[b].label}>
                      {BUCKET_META[b].emoji}
                    </span>
                    <div style={{ flex: 1 }}>
                      <ItemRow it={it} onToggle={() => toggle("weekly", it.id)} />
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="screen">
      <div className="brand">Marching Orders</div>
      <h1 className="title">The Plan</h1>
      <div className="subtitle">
        Not goals — the exact work that gets you there. You pick when; it tells you what.
      </div>

      {error && <div className="error-banner">{error}</div>}

      <button className="big-btn" disabled={busy !== null} onClick={() => openSetup("daily")}>
        {busy === "daily" ? "Building today's plan…" : "⚡ Generate today's attack plan"}
      </button>
      <button
        className="big-btn secondary"
        disabled={busy !== null}
        onClick={() => openSetup("weekly")}
      >
        {busy === "weekly" ? "Mapping the week…" : "🗓 Generate this week's plan"}
      </button>

      {(data.plans.daily || data.plans.weekly) && (
        <div className="pill-row">
          <button
            className={`pill ${dom === "all" ? "active" : ""}`}
            onClick={() => setDom("all")}
          >
            All
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
      )}

      {(() => {
        const soon = data.events
          .filter((e) => !e.done && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7)
          .sort((a, b) => a.date.localeCompare(b.date));
        return soon.length ? (
          <div className="card">
            <h3>On the radar this week</h3>
            {soon.map((e) => (
              <div className="action" key={e.id}>
                <div>
                  <div className="action-text">{e.title}</div>
                  <div className="action-meta" style={{ color: DOMAIN_META[e.domain].color }}>
                    {daysUntil(e.date) === 0 ? "TODAY" : `in ${daysUntil(e.date)}d`} · {e.date}
                    {e.time ? ` ${e.time}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null;
      })()}

      {setup && (
        <div className="modal-backdrop" onClick={() => setSetup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 6 }}>
              {setup === "daily" ? "Today's" : "This week's"} plan — two questions
            </h3>
            <div className="field-label">
              What matters most {setup === "daily" ? "today" : "this week"}? (optional)
            </div>
            <input
              className="text-input"
              placeholder={
                setup === "daily"
                  ? "e.g. finish the deck, long run, call Mom"
                  : "e.g. close the deal, taper for the race"
              }
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            />
            <div className="field-label">Intensity</div>
            <div className="intensity-row">
              {INTENSITIES.map((i) => (
                <button
                  key={i.key}
                  className={`intensity ${intensity === i.key ? "active" : ""}`}
                  onClick={() => setIntensity(i.key)}
                >
                  <span className="int-label">{i.label}</span>
                  <span className="int-desc">{i.desc}</span>
                </button>
              ))}
            </div>
            <button className="big-btn" style={{ marginTop: 14 }} onClick={() => run(setup)}>
              Build the plan →
            </button>
            <button
              className="big-btn secondary"
              style={{ marginBottom: 0 }}
              onClick={() => setSetup(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {data.assessment?.pushMessage && (
        <div className="card glow">
          <div className="push-message">{data.assessment.pushMessage}</div>
        </div>
      )}

      {renderDaily()}
      {renderWeekly()}

      {!data.plans.daily && !data.plans.weekly && (
        <div className="empty">
          <div className="big">🗡️</div>
          Generate a plan and the head coach will split your work into what MUST
          happen today, your everyday routines, and long-game progress — ranked by
          urgency.
        </div>
      )}
    </div>
  );
}
