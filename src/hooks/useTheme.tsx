import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
type Resolved = "light" | "dark";

export type AccentTheme =
  | "royal"
  | "green-island"
  | "pinkish"
  | "neon"
  | "techy"
  | "sunset";

type Ctx = {
  mode: ThemeMode;
  resolved: Resolved;
  setMode: (m: ThemeMode) => void;
  accent: AccentTheme;
  setAccent: (a: AccentTheme) => void;
};

const ThemeCtx = createContext<Ctx>({} as Ctx);
const MODE_KEY = "rechoir.theme";
const ACCENT_KEY = "rechoir.accent";

export const ACCENT_LIST: { id: AccentTheme; label: string; swatch: string; hint: string }[] = [
  { id: "royal", label: "Royal", swatch: "linear-gradient(135deg,#1d4ed8,#7c3aed)", hint: "Default — blue & violet" },
  { id: "green-island", label: "Green Island", swatch: "linear-gradient(135deg,#0e9f6e,#22d3aa)", hint: "Calm tropical greens" },
  { id: "pinkish", label: "Pinkish", swatch: "linear-gradient(135deg,#ec4899,#f472b6)", hint: "Soft, warm pinks" },
  { id: "neon", label: "Neon", swatch: "linear-gradient(135deg,#22d3ee,#a3e635)", hint: "High-voltage cyan & lime" },
  { id: "techy", label: "Techy", swatch: "linear-gradient(135deg,#0ea5e9,#6366f1)", hint: "Crisp electric blue" },
  { id: "sunset", label: "Sunset", swatch: "linear-gradient(135deg,#f97316,#ef4444)", hint: "Warm amber & coral" },
];

function applyMode(resolved: Resolved) {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0b1220" : "#ffffff");
}

function applyAccent(a: AccentTheme) {
  const root = document.documentElement;
  // Strip any previous accent class.
  ACCENT_LIST.forEach((x) => root.classList.remove(`accent-${x.id}`));
  root.classList.add(`accent-${a}`);
  root.dataset.accent = a;
}

function systemPrefers(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    () => (localStorage.getItem(MODE_KEY) as ThemeMode) || "system"
  );
  const [accent, setAccentState] = useState<AccentTheme>(
    () => (localStorage.getItem(ACCENT_KEY) as AccentTheme) || "royal"
  );
  const [resolved, setResolved] = useState<Resolved>(() =>
    mode === "system" ? systemPrefers() : (mode as Resolved)
  );

  useEffect(() => {
    const r: Resolved = mode === "system" ? systemPrefers() : (mode as Resolved);
    setResolved(r);
    applyMode(r);
  }, [mode]);

  useEffect(() => { applyAccent(accent); }, [accent]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { const r = systemPrefers(); setResolved(r); applyMode(r); };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [mode]);

  const setMode = (m: ThemeMode) => { localStorage.setItem(MODE_KEY, m); setModeState(m); };
  const setAccent = (a: AccentTheme) => { localStorage.setItem(ACCENT_KEY, a); setAccentState(a); };

  return (
    <ThemeCtx.Provider value={{ mode, resolved, setMode, accent, setAccent }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
