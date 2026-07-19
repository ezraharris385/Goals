import Anthropic from "@anthropic-ai/sdk";
import {
  AppData,
  ChatMsg,
  daysUntil,
  Domain,
  DOMAIN_META,
  Goal,
  goalPace,
  isRoutine,
  Timeframe,
  uid,
  todayISO,
} from "./types";

const MODEL = "claude-opus-4-8";

const TIMEFRAME_VALUES: Timeframe[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "short_term",
  "long_term",
];

function client(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// ---------- Tool definitions the coach agents can call ----------

const GOAL_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string", description: "Short, punchy goal title" },
    timeframe: {
      type: "string",
      enum: TIMEFRAME_VALUES,
      description:
        "daily/weekly/monthly/yearly for recurring-cadence goals; short_term (< ~3 months) or long_term for horizon goals",
    },
    why: { type: "string", description: "Why this matters to the user" },
    metric: {
      type: "string",
      description: "How progress is measured, as specific as possible",
    },
    target: { type: "string", description: "The concrete target value or end state" },
    deadline: { type: "string", description: "ISO date YYYY-MM-DD if there is one" },
  },
  required: ["title", "timeframe"],
};

const chatTools: Anthropic.Tool[] = [
  {
    name: "save_goals",
    description:
      "Save one or more structured goals extracted from the conversation. Call this whenever the user states a goal, even casually. Sharpen vague goals into specific, measurable ones before saving.",
    input_schema: {
      type: "object",
      properties: { goals: { type: "array", items: GOAL_SCHEMA } },
      required: ["goals"],
    },
  },
  {
    name: "update_goal",
    description:
      "Update an existing goal by id: progress percent, status, or refine its fields. Use when the user reports progress or wants to change a goal.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        progress: { type: "number", description: "0-100" },
        status: { type: "string", enum: ["active", "completed", "archived"] },
        title: { type: "string" },
        metric: { type: "string" },
        target: { type: "string" },
        deadline: { type: "string" },
        timeframe: { type: "string", enum: TIMEFRAME_VALUES },
      },
      required: ["id"],
    },
  },
  {
    name: "log_entry",
    description:
      "Log a progress entry / check-in the user reported. Include your honest one-line assessment of the effort. Also call update_goal if the report changes a goal's progress.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What the user did, in their words" },
        goal_id: { type: "string", description: "Related goal id if clear" },
        assessment: {
          type: "string",
          description: "Your blunt one-line coach assessment of this effort",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "delete_goal",
    description: "Archive a goal the user explicitly wants removed.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "save_events",
    description:
      "Save date-specific upcoming events the user mentions — interviews, races, exams, launches, meetings, deadlines-as-moments. These are NOT recurring goals; they are things happening on a specific date the user must be ready for. If sustained preparation is also needed, save a goal too.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string", description: "ISO date YYYY-MM-DD" },
              time: { type: "string", description: "HH:MM 24h if known" },
              notes: { type: "string", description: "What to prepare / watch out for" },
            },
            required: ["title", "date"],
          },
        },
      },
      required: ["events"],
    },
  },
  {
    name: "update_event",
    description:
      "Update or complete an upcoming event by id (reschedule, rename, mark done).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        date: { type: "string" },
        time: { type: "string" },
        notes: { type: "string" },
        done: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_event",
    description: "Remove an event the user explicitly wants deleted.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

// ---------- System prompts ----------

const PERSONAS: Record<Domain, string> = {
  health: `You are IRON, the health & fitness coach. Training, nutrition, sleep, recovery, mental resilience. You talk like a strength coach who has seen every excuse and accepts none of them. You know the difference between soreness and injury, between discipline and burnout — you push hard but you push smart.`,
  personal: `You are NORTH, the personal-life coach. Relationships, character, habits, learning, finances, faith, fun — the whole human. You cut through comfortable stories people tell themselves. You push for standards in private life as high as in public life, because who someone is when nobody watches is who they are.`,
  professional: `You are CLIMB, the career & professional coach. Skills, output, reputation, income, ambition. You think like a demanding mentor who believes the user is capable of far more than they're currently producing, and says so. Concrete deliverables and deadlines over vibes.`,
};

function goalLine(g: Goal): string {
  const pace = goalPace(g);
  const bits = [
    `[id:${g.id}] (${g.domain}) "${g.title}" — ${g.progress}%`,
    isRoutine(g) ? "ROUTINE" : "DATED",
    g.metric ? `metric: ${g.metric}` : "",
    g.target ? `target: ${g.target}` : "",
    g.deadline
      ? `deadline: ${g.deadline} (${daysUntil(g.deadline)} days away)`
      : "",
    pace
      ? `pace: should be at ~${pace.expected}% by now → ${pace.label.toUpperCase()} (${pace.delta >= 0 ? "+" : ""}${pace.delta})`
      : "",
    g.status !== "active" ? `status: ${g.status}` : "",
  ].filter(Boolean);
  return "- " + bits.join(" — ");
}

const TF_ORDER: Timeframe[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "short_term",
  "long_term",
];

function contextBlock(data: AppData, domain?: Domain) {
  const now = new Date();
  const goals = data.goals.filter(
    (g) => g.status !== "archived" && (!domain || g.domain === domain)
  );
  const byTf = TF_ORDER.map((tf) => {
    const list = goals.filter((g) => g.timeframe === tf);
    return list.length
      ? `${tf.toUpperCase()}:\n${list.map(goalLine).join("\n")}`
      : "";
  })
    .filter(Boolean)
    .join("\n");
  const upcoming = data.events
    .filter((e) => !e.done && daysUntil(e.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);
  const recentEntries = data.entries.slice(-15);
  return `<current_state>
Today: ${todayISO()} (${now.toLocaleDateString("en-US", { weekday: "long" })}), local time ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}.

Goals${domain ? ` (${domain})` : ""}, grouped by timeframe. ROUTINE = recurring habit cadence; DATED = marching toward a deadline. Pace shows where progress should be in the grand scheme of the goal's timeline:
${byTf || "(none yet)"}

Upcoming events (date-specific, not everyday goals):
${upcoming.length ? upcoming.map((e) => `- [event:${e.id}] ${e.date}${e.time ? ` ${e.time}` : ""} (${daysUntil(e.date)} days away, ${e.domain}): ${e.title}${e.notes ? ` — ${e.notes}` : ""}`).join("\n") : "(none)"}

Recent check-ins:
${recentEntries.length ? recentEntries.map((e) => `- ${e.date} (${e.domain}): ${e.text}`).join("\n") : "(none yet)"}
</current_state>`;
}

function chatSystem(domain: Domain, data: AppData): string {
  return `${PERSONAS[domain]}

You are one of three coach agents inside ZENITH, the user's personal goal command center. The user's stated identity goal: operate in the top 1% — world-class standards in life and in work, and they've asked to be pushed hard to get there. Hold them to that. Every session.

How you operate:
- When the user shares a goal — even loosely — interrogate it briefly if needed (one or two sharp questions max), then SAVE it with the save_goals tool as a specific, measurable goal with the right timeframe. Don't let vague goals live. "Get fit" becomes a metric and a deadline.
- LOCATE the specific goal before acting. current_state groups goals by timeframe with pace data — when the user mentions work, match it to the exact goal id in the relevant timeframe (e.g. "did my pushups" → the daily ROUTINE goal; "studied for the exam" → the DATED goal with that deadline). Name the goal you're updating so they know you're tracking the right thing.
- Distinguish ROUTINE from DATE-SPECIFIC. Recurring habits (pushups, weekly reviews) are daily/weekly goals. Things happening on a specific date (interview, race, exam, launch, trip) are EVENTS — save them with save_events so they show on the upcoming radar. If an event also needs sustained prep, save a goal for the prep too and mention both.
- Use the pace data. If a DATED goal is BEHIND its timeline, say so with the numbers and make it today's priority. If AHEAD, acknowledge it and raise the bar. The grand scheme matters: connect today's work to where the timeline says they should be.
- When the user reports what they did (or didn't do), log it with log_entry and update the relevant goal's progress with update_goal. Give a blunt assessment. Praise real wins hard; call out weak efforts directly.
- Push. High standards, zero contempt. You're demanding because you believe in their ceiling. Never coddle, never lecture for paragraphs.
- Keep replies tight: 2-6 sentences usually. Punchy. Ask one question at a time. This is a phone app — no walls of text, no headers, minimal lists.
- Only handle ${DOMAIN_META[domain].label.toLowerCase()} topics; if the user brings up another life area, give one line and point them to the right coach (IRON=health, NORTH=personal, CLIMB=professional).
- Use the goal/event ids from current_state when updating. Never invent ids.

${contextBlock(data, domain)}`;
}

// ---------- Chat with tool loop ----------

export interface ToolActions {
  saveGoals: (goals: Partial<Goal>[]) => string;
  updateGoal: (input: any) => string;
  logEntry: (input: any) => string;
  deleteGoal: (id: string) => string;
  saveEvents: (events: any[]) => string;
  updateEvent: (input: any) => string;
  deleteEvent: (id: string) => string;
}

export async function sendChat(
  apiKey: string,
  domain: Domain,
  history: ChatMsg[],
  userText: string,
  data: AppData,
  actions: ToolActions
): Promise<string> {
  const c = client(apiKey);
  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-30).map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userText },
  ];

  for (let i = 0; i < 8; i++) {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: chatSystem(domain, data),
      tools: chatTools,
      messages,
    });

    if (resp.stop_reason === "refusal") {
      return "I can't help with that one. Let's get back to the work.";
    }

    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;
        let result = "";
        try {
          const input = block.input as any;
          if (block.name === "save_goals") result = actions.saveGoals(input.goals ?? []);
          else if (block.name === "update_goal") result = actions.updateGoal(input);
          else if (block.name === "log_entry") result = actions.logEntry(input);
          else if (block.name === "delete_goal") result = actions.deleteGoal(input.id);
          else if (block.name === "save_events") result = actions.saveEvents(input.events ?? []);
          else if (block.name === "update_event") result = actions.updateEvent(input);
          else if (block.name === "delete_event") result = actions.deleteEvent(input.id);
          else result = `Unknown tool ${block.name}`;
        } catch (e: any) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${e?.message ?? e}`,
            is_error: true,
          });
          continue;
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    return resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
  return "…that ran long. Say it again, shorter.";
}

// ---------- Plan generation (forced tool for structured output) ----------

const planTool: Anthropic.Tool = {
  name: "create_plan",
  description: "Create the user's action plan and current performance assessment.",
  input_schema: {
    type: "object",
    properties: {
      focus: {
        type: "string",
        description: "One sentence: the single most important theme for this period",
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description:
                "A concrete, executable action (not a goal). Specific numbers, durations, deliverables. Never include a time of day.",
            },
            date: { type: "string", description: "ISO date YYYY-MM-DD this belongs to" },
            domain: { type: "string", enum: ["health", "personal", "professional"] },
            goal_id: { type: "string", description: "The goal id this action serves" },
            bucket: {
              type: "string",
              enum: ["must_do", "routine", "long_term"],
              description:
                "must_do: has to happen on this specific date (deadline, event prep, date-critical). routine: an everyday recurring habit. long_term: moves a longer-horizon goal forward.",
            },
            urgency: {
              type: "string",
              enum: ["critical", "high", "normal"],
              description:
                "critical: skipping it has real consequences. high: important, should not slip. normal: everything else.",
            },
          },
          required: ["text", "date", "domain", "bucket", "urgency"],
        },
      },
      doing_well: {
        type: "array",
        items: { type: "string" },
        description: "2-4 short bullets: where the user is genuinely performing",
      },
      needs_work: {
        type: "array",
        items: { type: "string" },
        description: "2-4 short bullets: where they're slipping or underperforming",
      },
      push_message: {
        type: "string",
        description:
          "One or two hard-hitting sentences to fire the user up for this period",
      },
    },
    required: ["focus", "items", "doing_well", "needs_work", "push_message"],
  },
};

export interface GeneratedPlan {
  focus: string;
  items: {
    text: string;
    date: string;
    domain: Domain;
    goal_id?: string;
    bucket: "must_do" | "routine" | "long_term";
    urgency: "critical" | "high" | "normal";
  }[];
  doingWell: string[];
  needsWork: string[];
  pushMessage: string;
}

export type Intensity = "steady" | "push" | "max";

const INTENSITY_GUIDE: Record<Intensity, string> = {
  steady:
    "STEADY intensity: a sustainable, disciplined day — roughly 4-6 focused items per day. Protect recovery and consistency.",
  push:
    "PUSH intensity: a demanding load — roughly 6-9 items per day, include at least one stretch action outside the comfort zone.",
  max:
    "MAX intensity: peak output — pack the day (8-12 items). Only what moves the needle.",
};

export async function generatePlan(
  apiKey: string,
  scope: "daily" | "weekly",
  data: AppData,
  opts: { focus?: string; intensity: Intensity }
): Promise<GeneratedPlan> {
  const c = client(apiKey);
  const horizon =
    scope === "daily"
      ? `TODAY, ${todayISO()}. Every item dated ${todayISO()}.`
      : `THE NEXT 7 DAYS starting ${todayISO()}. Spread items across real dates with the actual weekday rhythm in mind (weekday vs weekend).`;

  const resp = await c.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: `You are the head coach of ZENITH, the user's goal command center — you sit above IRON (health), NORTH (personal), and CLIMB (professional). The user's identity goal: operate in the top 1% — world-class standards in life and in work — and they've asked to be pushed hard.

Build the plan for ${horizon}

${INTENSITY_GUIDE[opts.intensity]}
${opts.focus ? `The user's stated focus for this period: "${opts.focus}". Build the plan around it while keeping other goals from stalling.` : ""}

Rules:
- Items are ACTIONS, not goals: "45 min zone-2 run", not "exercise more". Specific numbers, durations, deliverables.
- NEVER include a time of day in any item — no "at 6:00", no "morning run". The user decides when. Describe only WHAT must get done.
- Classify every item into a bucket: must_do (has to happen on that specific date — deadlines, event prep, date-critical work), routine (everyday recurring habits like daily training or reading), long_term (advances a longer-horizon goal that isn't date-critical today).
- Rank every item's urgency honestly: critical only when skipping it has real consequences; most items are high or normal. Don't inflate.
- Every item must trace to a real goal id from current_state when possible.
- Use the PACE data: weight the plan toward DATED goals marked BEHIND their timeline, and toward near deadlines. Keep ROUTINE goals present every day they apply.
- Check upcoming events: schedule prep actions ahead of any event inside (or just after) this period as must_do items.
- Be honest in doing_well / needs_work — reference the pace data and where the timeline says they should be. If recent check-ins are empty, say so in needs_work: showing up to report is the first standard.
- push_message: talk like a coach who expects greatness. Direct, personal, no clichés.

${contextBlock(data)}`,
    tools: [planTool],
    tool_choice: { type: "tool", name: "create_plan" },
    messages: [
      {
        role: "user",
        content: `Generate my ${scope} plan now at ${opts.intensity} intensity.`,
      },
    ],
  });

  const toolUse = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) throw new Error("No plan returned");
  const input = toolUse.input as any;
  return {
    focus: input.focus ?? "",
    items: (input.items ?? []).map((it: any) => ({
      text: it.text,
      date: it.date,
      domain: (["health", "personal", "professional"].includes(it.domain)
        ? it.domain
        : "personal") as Domain,
      goal_id: it.goal_id,
      bucket: ["must_do", "routine", "long_term"].includes(it.bucket)
        ? it.bucket
        : "long_term",
      urgency: ["critical", "high", "normal"].includes(it.urgency)
        ? it.urgency
        : "normal",
    })),
    doingWell: input.doing_well ?? [],
    needsWork: input.needs_work ?? [],
    pushMessage: input.push_message ?? "",
  };
}

// ---------- Brain dump: paste everything, AI sorts it into goals ----------

const dumpTool: Anthropic.Tool = {
  name: "save_sorted_goals",
  description: "Save the structured goals extracted from the user's brain dump.",
  input_schema: {
    type: "object",
    properties: {
      goals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ...GOAL_SCHEMA.properties,
            domain: {
              type: "string",
              enum: ["health", "personal", "professional"],
              description: "Which life area this goal belongs to",
            },
          },
          required: ["title", "timeframe", "domain"],
        },
      },
    },
    required: ["goals"],
  },
};

export interface DumpedGoal {
  title: string;
  domain: Domain;
  timeframe: Timeframe;
  why?: string;
  metric?: string;
  target?: string;
  deadline?: string;
}

export async function importGoals(
  apiKey: string,
  text: string,
  data: AppData
): Promise<DumpedGoal[]> {
  const c = client(apiKey);
  const resp = await c.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: `You turn a raw brain dump of goals into a clean, structured goal list for a high-standards goal tracker. Today is ${todayISO()}.

Rules:
- Extract EVERY distinct goal mentioned. Split compound statements into separate goals.
- Sharpen vague goals: give each a concrete metric and target where the text allows. Don't invent specifics the user clearly didn't imply — leave metric/target empty instead.
- Classify domain: health (body, fitness, sleep, food, mental health), professional (career, work, skills, income, business), personal (everything else — relationships, habits, money management, learning for fun, character).
- Pick timeframe: daily/weekly/monthly/yearly for recurring-cadence goals; short_term (< ~3 months) or long_term for horizon goals.
- Skip duplicates of these existing goals: ${data.goals.filter((g) => g.status !== "archived").map((g) => g.title).join("; ") || "(none)"}`,
    tools: [dumpTool],
    tool_choice: { type: "tool", name: "save_sorted_goals" },
    messages: [{ role: "user", content: text }],
  });
  const toolUse = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) throw new Error("Couldn't parse any goals from that.");
  const input = toolUse.input as any;
  return (input.goals ?? [])
    .filter((g: any) => g?.title)
    .map((g: any) => ({
      title: g.title,
      domain: ["health", "personal", "professional"].includes(g.domain)
        ? g.domain
        : "personal",
      timeframe: TIMEFRAME_VALUES.includes(g.timeframe) ? g.timeframe : "short_term",
      why: g.why,
      metric: g.metric,
      target: g.target,
      deadline: g.deadline,
    }));
}

// ---------- Friendly error messages ----------

export function friendlyError(e: any): string {
  const msg = String(e?.message ?? e ?? "");
  const status = e?.status;
  if (status === 401 || /authentication|invalid x-api-key/i.test(msg))
    return "Your API key was rejected. Double-check it in Setup (it should start with sk-ant-).";
  if (status === 429 || /rate limit/i.test(msg))
    return "Hitting the rate limit — give it a minute and try again.";
  if (status === 529 || /overloaded/i.test(msg))
    return "Anthropic's servers are busy right now. Try again in a moment.";
  if (/fetch|network|Failed to fetch|connection/i.test(msg))
    return "No connection to the AI. Check your internet and try again.";
  if (/credit|billing/i.test(msg))
    return "Your Anthropic account is out of credits — top up at console.anthropic.com.";
  return msg || "Something went wrong. Try again.";
}

export { uid };
