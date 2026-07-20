import { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  ActionItem,
  BUCKET_META,
  Domain,
  DOMAIN_META,
  EventItem,
  Goal,
  itemBucket,
  todayISO,
} from "../types";

type CalItem = {
  key: string;
  kind: "event" | "deadline" | "action";
  title: string;
  domain: Domain;
  done?: boolean;
  time?: string;
  sub?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function fmtLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function Calendar() {
  const { data } = useStore();
  const [mode, setMode] = useState<"week" | "month">("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<string>(todayISO());
  const today = todayISO();

  // Build: ISO date -> items (events, goal deadlines, plan actions)
  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    const push = (date: string, item: CalItem) =>
      map.set(date, [...(map.get(date) ?? []), item]);

    for (const e of data.events as EventItem[]) {
      push(e.date, {
        key: `e-${e.id}`,
        kind: "event",
        title: e.title,
        domain: e.domain,
        done: e.done,
        time: e.time,
        sub: e.notes,
      });
    }
    for (const g of data.goals as Goal[]) {
      if (g.deadline && g.status !== "archived") {
        push(g.deadline, {
          key: `g-${g.id}`,
          kind: "deadline",
          title: g.title,
          domain: g.domain,
          done: g.status === "completed",
        });
      }
    }
    for (const scope of ["daily", "weekly"] as const) {
      for (const it of (data.plans[scope]?.items ?? []) as ActionItem[]) {
        push(it.date, {
          key: `a-${it.id}`,
          kind: "action",
          title: it.text,
          domain: it.domain,
          done: it.done,
          sub: BUCKET_META[itemBucket(it)].label,
        });
      }
    }
    return map;
  }, [data.events, data.goals, data.plans]);

  const shift = (dir: number) => {
    const d = new Date(anchor);
    if (mode === "month") {
      // Pin to the 1st before shifting so short months aren't skipped
      // (e.g. Jan 31 + 1 month must land on Feb, not overflow to March).
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setDate(d.getDate() + 7 * dir);
    }
    setAnchor(d);
  };

  const monthCells = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const startDow = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [anchor]);

  const weekDays = useMemo(() => {
    const base = new Date(anchor);
    base.setDate(base.getDate() - base.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [anchor]);

  const headerLabel =
    mode === "month"
      ? anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const dots = (iso: string) => {
    const items = byDate.get(iso) ?? [];
    const domains = [...new Set(items.map((i) => i.domain))].slice(0, 3);
    return { items, domains };
  };

  const renderItems = (items: CalItem[]) =>
    items
      .slice()
      .sort((a, b) => a.kind.localeCompare(b.kind) || (a.time ?? "").localeCompare(b.time ?? ""))
      .map((it) => {
        const meta = DOMAIN_META[it.domain];
        const icon =
          it.kind === "event" ? "📅" : it.kind === "deadline" ? "⏳" : it.done ? "✓" : "○";
        return (
          <div className={`cal-item ${it.done ? "done" : ""}`} key={it.key}>
            <span className="cal-item-icon" style={{ color: meta.color }}>
              {icon}
            </span>
            <div>
              <div className="cal-item-title">
                {it.kind === "deadline" ? "Deadline: " : ""}
                {it.title}
              </div>
              <div className="cal-item-meta" style={{ color: meta.color }}>
                {it.time ? `${it.time} · ` : ""}
                {meta.label}
                {it.sub ? ` · ${it.sub}` : ""}
              </div>
            </div>
          </div>
        );
      });

  return (
    <div className="screen">
      <div className="brand">Timeline</div>
      <h1 className="title">Calendar</h1>
      <div className="subtitle">Everything on the board, by the day.</div>

      <div className="seg-row">
        <button
          className={`seg ${mode === "week" ? "active" : ""}`}
          onClick={() => setMode("week")}
        >
          Week
        </button>
        <button
          className={`seg ${mode === "month" ? "active" : ""}`}
          onClick={() => setMode("month")}
        >
          Month
        </button>
      </div>

      <div className="cal-nav">
        <button className="cal-arrow" onClick={() => shift(-1)}>
          ‹
        </button>
        <div className="cal-label">{headerLabel}</div>
        <button className="cal-arrow" onClick={() => shift(1)}>
          ›
        </button>
      </div>

      {mode === "month" ? (
        <>
          <div className="card" style={{ padding: 12 }}>
            <div className="cal-grid cal-dow">
              {DOW.map((d, i) => (
                <div className="cal-dow-cell" key={i}>
                  {d}
                </div>
              ))}
            </div>
            <div className="cal-grid">
              {monthCells.map((d, i) => {
                if (!d) return <div className="cal-cell empty" key={i} />;
                const iso = isoOf(d);
                const { domains } = dots(iso);
                const has = (byDate.get(iso) ?? []).length;
                return (
                  <button
                    key={i}
                    className={`cal-cell ${iso === today ? "today" : ""} ${
                      iso === selected ? "sel" : ""
                    }`}
                    onClick={() => setSelected(iso)}
                  >
                    <span className="cal-num">{d.getDate()}</span>
                    <span className="cal-dots">
                      {domains.map((dm) => (
                        <span
                          className="cal-dot"
                          key={dm}
                          style={{ background: DOMAIN_META[dm].color }}
                        />
                      ))}
                      {has > domains.length && domains.length > 0 && (
                        <span className="cal-more">+</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="date-header" style={{ color: "var(--accent)" }}>
            {fmtLong(selected)}
          </div>
          {(byDate.get(selected) ?? []).length === 0 ? (
            <div className="empty" style={{ padding: "20px 0" }}>
              Nothing scheduled this day.
            </div>
          ) : (
            <div className="card">{renderItems(byDate.get(selected)!)}</div>
          )}
        </>
      ) : (
        weekDays.map((d) => {
          const iso = isoOf(d);
          const items = byDate.get(iso) ?? [];
          return (
            <div className="card week-day" key={iso}>
              <div className={`week-day-head ${iso === today ? "today" : ""}`}>
                {d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                {iso === today ? " · Today" : ""}
              </div>
              {items.length === 0 ? (
                <div className="week-empty">—</div>
              ) : (
                renderItems(items)
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
