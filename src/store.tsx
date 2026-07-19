import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppData, emptyData } from "./types";

const STORAGE_KEY = "animal-goals-v1";

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    return { ...emptyData(), ...parsed, chats: { ...emptyData().chats, ...parsed.chats } };
  } catch {
    return emptyData();
  }
}

interface StoreCtx {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => fn(structuredClone(prev)));
  }, []);

  return <Ctx.Provider value={{ data, update }}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}
