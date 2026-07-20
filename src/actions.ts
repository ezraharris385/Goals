import { ToolActions } from "./ai";
import { AppData, Domain, PendingGoal, Timeframe, todayISO, uid } from "./types";

const TF: Timeframe[] = ["daily", "weekly", "monthly", "yearly", "short_term", "long_term"];

// Tool actions the coach agents execute against the store.
export function makeToolActions(
  domain: Domain,
  update: (fn: (d: AppData) => AppData) => void
): ToolActions {
  return {
    saveGoals(goals) {
      const proposed: PendingGoal[] = goals
        .filter((g) => g.title)
        .map((g) => ({
          id: uid(),
          domain,
          timeframe: TF.includes(g.timeframe as Timeframe)
            ? (g.timeframe as Timeframe)
            : "short_term",
          title: g.title!,
          why: g.why,
          metric: g.metric,
          target: g.target,
          deadline: g.deadline,
        }));
      if (!proposed.length) return "No valid goals provided.";
      update((d) => ({ ...d, pending: [...d.pending, ...proposed] }));
      return `Proposed ${proposed.length} goal(s) for the user to REVIEW and approve (NOT saved yet — they'll appear in a review card where the user checks off which to keep): ${proposed
        .map((g) => g.title)
        .join("; ")}. Tell the user briefly to review the card and confirm.`;
    },

    updateGoal(input) {
      let found = false;
      update((d) => {
        const g = d.goals.find((x) => x.id === input.id);
        if (!g) return d;
        found = true;
        if (typeof input.progress === "number")
          g.progress = Math.max(0, Math.min(100, Math.round(input.progress)));
        if (input.status) g.status = input.status;
        if (input.title) g.title = input.title;
        if (input.metric) g.metric = input.metric;
        if (input.target) g.target = input.target;
        if (input.deadline) g.deadline = input.deadline;
        if (TF.includes(input.timeframe)) g.timeframe = input.timeframe;
        if (input.status === "completed") g.progress = 100;
        return d;
      });
      return found ? `Goal ${input.id} updated.` : `No goal with id ${input.id}.`;
    },

    logEntry(input) {
      const id = uid();
      update((d) => ({
        ...d,
        entries: [
          ...d.entries,
          {
            id,
            goalId: input.goal_id,
            domain,
            text: input.text,
            assessment: input.assessment,
            date: todayISO(),
          },
        ],
      }));
      return `Entry logged for ${todayISO()}.`;
    },

    deleteGoal(id) {
      let found = false;
      update((d) => {
        const g = d.goals.find((x) => x.id === id);
        if (g) {
          g.status = "archived";
          found = true;
        }
        return d;
      });
      return found ? `Goal ${id} archived.` : `No goal with id ${id}.`;
    },

    saveEvents(events) {
      const created = (events ?? [])
        .filter((e: any) => e?.title && e?.date)
        .map((e: any) => ({
          id: uid(),
          title: e.title,
          date: e.date,
          time: e.time,
          notes: e.notes,
          domain,
          done: false,
        }));
      if (!created.length) return "No valid events provided.";
      update((d) => ({ ...d, events: [...d.events, ...created] }));
      return `Saved ${created.length} event(s): ${created
        .map((e: any) => `${e.title} on ${e.date} [event:${e.id}]`)
        .join("; ")}`;
    },

    updateEvent(input) {
      let found = false;
      update((d) => {
        const e = d.events.find((x) => x.id === input.id);
        if (!e) return d;
        found = true;
        if (input.title) e.title = input.title;
        if (input.date) e.date = input.date;
        if (input.time !== undefined) e.time = input.time;
        if (input.notes !== undefined) e.notes = input.notes;
        if (typeof input.done === "boolean") e.done = input.done;
        return d;
      });
      return found ? `Event ${input.id} updated.` : `No event with id ${input.id}.`;
    },

    deleteEvent(id) {
      let found = false;
      update((d) => {
        const idx = d.events.findIndex((x) => x.id === id);
        if (idx >= 0) {
          d.events.splice(idx, 1);
          found = true;
        }
        return d;
      });
      return found ? `Event ${id} deleted.` : `No event with id ${id}.`;
    },
  };
}
