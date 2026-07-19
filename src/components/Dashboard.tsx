import { useStore } from "../store";
import { DOMAINS, DOMAIN_META, todayISO } from "../types";
import { Ring } from "./Ring";

function computeStreak(dates: Set<string>): number {
  let streak = 0;
  const d = new Date();
  // today counts if present; otherwise start from yesterday
  const iso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")}`;
  if (!dates.has(iso(d))) d.setDate(d.getDate() - 1);
  while (dates.has(iso(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function Dashboard({ goTo }: { goTo: (tab: string) => void }) {
  const { data, update } = useStore();
  const active = data.goals.filter((g) => g.status === "active");
  const momentum = active.length
    ? Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length)
    : 0;

  const activityDates = new Set<string>([
    ...data.entries.map((e) => e.date),
    ...(data.plans.daily?.items ?? []).filter((i) => i.done).map((i) => i.date),
    ...(data.plans.weekly?.items ?? []).filter((i) => i.done).map((i) => i.date),
  ]);
  const streak = computeStreak(activityDates);

  const today = todayISO();
  const todaysItems = [
    ...(data.plans.daily?.items ?? []),
    ...(data.plans.weekly?.items ?? []),
  ]
    .filter((i) => i.date === today)
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  const doneToday = todaysItems.filter((i) => i.done).length;

  const toggleItem = (id: string) =>
    update((d) => {
      for (const scope of ["daily", "weekly"] as const) {
        const it = d.plans[scope]?.items.find((x) => x.id === id);
        if (it) it.done = !it.done;
      }
      return d;
    });

  const a = data.assessment;

  return (
    <div className="screen">
      <div className="brand">Animal Mode</div>
      <h1 className="title">Command Center</h1>
      <div className="subtitle">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </div>

      <div className="card glow">
        <div className="hero">
          <div>
            <div className="hero-num">{momentum}%</div>
            <div className="hero-label">Momentum</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 20 }}>
              <span className="streak-flame">🔥</span> {streak}-day streak
            </div>
            <div className="hero-label" style={{ marginTop: 2 }}>
              {active.length} active goal{active.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        {a?.pushMessage && <div className="push-message" style={{ marginTop: 14 }}>{a.pushMessage}</div>}
      </div>

      <div className="card">
        <h3>Progress by Front</h3>
        <div className="rings">
          {DOMAINS.map((dom) => {
            const goals = active.filter((g) => g.domain === dom);
            const pct = goals.length
              ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length)
              : 0;
            const meta = DOMAIN_META[dom];
            return (
              <div className="ring-block" key={dom}>
                <div className="ring-wrap">
                  <Ring pct={pct} color={meta.color} />
                  <div className="ring-center" style={{ color: meta.color }}>
                    {pct}%
                  </div>
                </div>
                <div className="ring-label">{meta.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>
          Today's Attack — {doneToday}/{todaysItems.length}
        </h3>
        {todaysItems.length === 0 ? (
          <div className="empty" style={{ padding: "14px 0" }}>
            No plan for today yet.
            <br />
            <button
              className="big-btn"
              style={{ marginTop: 14 }}
              onClick={() => goTo("plan")}
            >
              Build today's plan →
            </button>
          </div>
        ) : (
          todaysItems.map((it) => (
            <div className={`action ${it.done ? "done-row" : ""}`} key={it.id}>
              <button
                className={`action-check ${it.done ? "done" : ""}`}
                onClick={() => toggleItem(it.id)}
              >
                {it.done ? "✓" : ""}
              </button>
              <div>
                <div className="action-text">{it.text}</div>
                <div className="action-meta" style={{ color: DOMAIN_META[it.domain].color }}>
                  {it.time ? `${it.time} · ` : ""}
                  {DOMAIN_META[it.domain].label}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {a && (
        <>
          <div className="card">
            <h3>Where You're Winning</h3>
            <ul className="bullet-list win">
              {a.doingWell.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>Where You're Slipping</h3>
            <ul className="bullet-list attack">
              {a.needsWork.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {active.length === 0 && (
        <div className="empty">
          <div className="big">🐺</div>
          No goals yet. Talk to your coaches — tell them what you're going after, and
          they'll lock it in.
          <button className="big-btn" style={{ marginTop: 16 }} onClick={() => goTo("chat")}>
            Meet your coaches →
          </button>
        </div>
      )}
    </div>
  );
}
