import { useState } from "react";
import { useStore } from "../store";
import { emptyData } from "../types";

export function Settings() {
  const { data, update } = useStore();
  const [key, setKey] = useState(data.settings.apiKey);
  const [saved, setSaved] = useState(false);

  const save = () => {
    update((d) => ({ ...d, settings: { ...d.settings, apiKey: key.trim() } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zenith-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        update(() => ({ ...emptyData(), ...parsed }));
        alert("Data restored.");
      } catch {
        alert("That file didn't parse. Nothing changed.");
      }
    };
    inp.click();
  };

  const wipe = () => {
    if (confirm("Delete ALL goals, entries, plans and chats? This cannot be undone.")) {
      const apiKey = data.settings.apiKey;
      update(() => ({ ...emptyData(), settings: { apiKey } }));
    }
  };

  return (
    <div className="screen">
      <div className="brand">Setup</div>
      <h1 className="title">Settings</h1>
      <div className="subtitle">One key. Everything stays on your phone.</div>

      <div className="card">
        <div className="field-label">Anthropic API Key</div>
        <input
          className="text-input"
          type="password"
          placeholder="sk-ant-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <div className="hint">
          Get one at console.anthropic.com → API Keys. It's stored only in this
          browser's local storage and sent only to Anthropic's API. Your goals, chats,
          and plans never leave this device.
        </div>
        <button className="big-btn" style={{ marginTop: 14 }} onClick={save}>
          {saved ? "Saved ✓" : "Save key"}
        </button>
      </div>

      <div className="card">
        <div className="field-label">Data</div>
        <button className="big-btn secondary" onClick={exportData}>
          ⬇ Export backup (JSON)
        </button>
        <button className="big-btn secondary" onClick={importData}>
          ⬆ Restore from backup
        </button>
        <button
          className="big-btn secondary"
          style={{ color: "var(--danger)", borderColor: "rgba(248,113,113,0.4)" }}
          onClick={wipe}
        >
          Delete all data
        </button>
        <div className="hint">
          Everything lives in this browser. Export a backup now and then — clearing
          Safari/Chrome site data wipes the app.
        </div>
      </div>

      <div className="card">
        <div className="field-label">Install on your phone</div>
        <div className="hint">
          iPhone: open this site in Safari → Share → "Add to Home Screen".
          <br />
          Android: Chrome → menu (⋮) → "Add to Home screen".
          <br />
          It runs full-screen like a native app.
        </div>
      </div>
    </div>
  );
}
