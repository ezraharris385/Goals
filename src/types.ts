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

export interface ActionItem {
  id: string;
  text: string;
  date: string; // ISO date this must happen
  time?: string; // e.g. "06:00"
  domain: Domain;
  goalId?: string;
  done: boolean;
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
  plans: {},
  chats: { health: [], personal: [], professional: [] },
  settings: { apiKey: "" },
});

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};
