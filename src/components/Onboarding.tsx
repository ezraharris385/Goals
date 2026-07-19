import { useState } from "react";
import { useStore } from "../store";

export function Onboarding({ done }: { done: () => void }) {
  const { update } = useStore();
  const [key, setKey] = useState("");

  const start = (withKey: boolean) => {
    update((d) => ({
      ...d,
      settings: {
        ...d.settings,
        apiKey: withKey ? key.trim() : d.settings.apiKey,
        onboarded: true,
      },
    }));
    done();
  };

  return (
    <div className="screen onboard">
      <div style={{ marginTop: 30 }}>
        <div className="brand">Zenith</div>
        <h1 className="title" style={{ fontSize: 40 }}>
          High standards.
          <br />
          Zero excuses.
        </h1>
        <div className="subtitle" style={{ fontSize: 16, marginTop: 8 }}>
          Three AI coaches. One dashboard. Every goal in your life — tracked,
          planned, and pushed.
        </div>
      </div>

      <div className="card glow" style={{ marginTop: 10 }}>
        <div className="ob-step">
          <span className="ob-num">1</span>
          <div>
            Get a free API key at{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)", fontWeight: 800 }}
            >
              console.anthropic.com
            </a>{" "}
            (sign up → API Keys → Create Key)
          </div>
        </div>
        <div className="ob-step">
          <span className="ob-num">2</span>
          <div>Paste it here — it stays on your phone, nowhere else:</div>
        </div>
        <input
          className="text-input"
          type="password"
          placeholder="sk-ant-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          style={{ margin: "8px 0 14px" }}
        />
        <div className="ob-step">
          <span className="ob-num">3</span>
          <div>Dump your goals on your coaches and get to work.</div>
        </div>
        <button
          className="big-btn"
          style={{ marginTop: 14 }}
          disabled={!key.trim()}
          onClick={() => start(true)}
        >
          Begin the climb ↑
        </button>
        <button
          className="big-btn secondary"
          style={{ marginBottom: 0 }}
          onClick={() => start(false)}
        >
          Look around first (add key later)
        </button>
      </div>
    </div>
  );
}
