export type Domain = "health" | "personal" | "professional";

export type Timeframe =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "short_term"
  | "long_term";

export interface Goal {
  id: string;
  domain: Domain;
  timeframe: Timeframe;
  title: string;
  why?: string;
  metric?: string;
  target?: string;
  deadline?: string; // ISO date
  progress: number; // 0-100
  status: "active" | "completed" | "archived";
  createdAt: string;
}

export interface Entry {
  id: string;
  goalId?: string;
  domain: Domain;
  text: string;
  assessment?: string;
  date: string; // ISO date
}

export interface EventItem {
  id: string;
  title: string;
  date: string; // ISO date this happens
  time?: string;
  domain: Domain;
  notes?: string;
  done: boolean;
}

export type Bucket = "must_do" | "routine" | "long_term";
export type Urgency = "critical" | "high" | "normal";

export interface ActionItem {
  id: string;
  text: string;
  date: string; // ISO date this belongs to
  time?: string; // legacy — no longer generated or shown
  domain: Domain;
  goalId?: string;
  bucket?: Bucket;
  urgency?: Urgency;
  done: boolean;
}

export const BUCKET_META: Record<Bucket, { label: string; emoji: string; order: number }> = {
  must_do: { label: "Must do today", emoji: "🔥", order: 0 },
  routine: { label: "Every day", emoji: "🔁", order: 1 },
  long_term: { label: "Long game", emoji: "📈", order: 2 },
};

export const URGENCY_META: Record<Urgency, { label: string; color: string; order: number }> = {
  critical: { label: "URGENT", color: "#f87171", order: 0 },
  high: { label: "HIGH", color: "#fbbf24", order: 1 },
  normal: { label: "", color: "", order: 2 },
};

export const itemBucket = (i: ActionItem): Bucket => i.bucket ?? "must_do";
export const itemUrgency = (i: ActionItem): Urgency => i.urgency ?? "normal";

export function sortItems(a: ActionItem, b: ActionItem): number {
  return (
    BUCKET_META[itemBucket(a)].order - BUCKET_META[itemBucket(b)].order ||
    URGENCY_META[itemUrgency(a)].order - URGENCY_META[itemUrgency(b)].order
  );
}

export interface Plan {
  scope: "daily" | "weekly";
  generatedAt: string;
  focus: string;
  items: ActionItem[];
}

export interface Assessment {
  doingWell: string[];
  needsWork: string[];
  pushMessage: string;
  updatedAt: string;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface AppData {
  goals: Goal[];
  entries: Entry[];
  events: EventItem[];
  plans: { daily?: Plan; weekly?: Plan };
  chats: Record<Domain, ChatMsg[]>;
  assessment?: Assessment;
  settings: { apiKey: string; onboarded?: boolean };
}

export const DOMAINS: Domain[] = ["health", "personal", "professional"];

export const DOMAIN_META: Record<
  Domain,
  { label: string; agent: string; color: string; emoji: string }
> = {
  health: { label: "Health", agent: "IRON", color: "#34d399", emoji: "🫀" },
  personal: { label: "Personal", agent: "NORTH", color: "#a78bfa", emoji: "🧭" },
  professional: { label: "Professional", agent: "CLIMB", color: "#fbbf24", emoji: "📈" },
};

export const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "short_term", label: "Short" },
  { key: "long_term", label: "Long" },
];

export const emptyData = (): AppData => ({
  goals: [],
  entries: [],
  events: [],
  plans: {},
  chats: { health: [], personal: [], professional: [] },
  settings: { apiKey: "" },
});

// Routine goals recur on a cadence; dated goals march toward a deadline.
export const isRoutine = (g: Goal) =>
  g.timeframe === "daily" || g.timeframe === "weekly";

// Grand-scheme pacing: where progress *should* be, given time elapsed
// between creation and deadline.
export function goalPace(
  g: Goal
): { expected: number; delta: number; label: "ahead" | "on_track" | "behind" } | null {
  if (!g.deadline || g.status !== "active") return null;
  const start = new Date(g.createdAt).getTime();
  const end = new Date(`${g.deadline}T23:59:59`).getTime();
  const now = Date.now();
  if (!(end > start)) return null;
  const expected = Math.round(
    Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  );
  const delta = g.progress - expected;
  return {
    expected,
    delta,
    label: delta < -10 ? "behind" : delta > 10 ? "ahead" : "on_track",
  };
}

export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const [ty, tm, td] = todayISO().split("-").map(Number);
  const today = new Date(ty, tm - 1, td).getTime();
  return Math.round((target - today) / 86400000);
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};
