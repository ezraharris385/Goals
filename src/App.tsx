import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { GoalsView } from "./components/GoalsView";
import { PlanView } from "./components/PlanView";
import { ChatView } from "./components/ChatView";
import { Settings } from "./components/Settings";
import { Onboarding } from "./components/Onboarding";
import { useStore } from "./store";

const TABS = [
  { key: "dash", label: "Home", ico: "🏠" },
  { key: "goals", label: "Goals", ico: "🎯" },
  { key: "plan", label: "Plan", ico: "⚡" },
  { key: "chat", label: "Coaches", ico: "🥊" },
  { key: "settings", label: "Setup", ico: "⚙️" },
];

export default function App() {
  const { data } = useStore();
  const [tab, setTab] = useState("dash");

  if (!data.settings.onboarded && !data.settings.apiKey) {
    return <Onboarding done={() => setTab("chat")} />;
  }

  return (
    <div className="app">
      {tab === "dash" && <Dashboard goTo={setTab} />}
      {tab === "goals" && <GoalsView />}
      {tab === "plan" && <PlanView />}
      {tab === "chat" && <ChatView />}
      {tab === "settings" && <Settings />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
