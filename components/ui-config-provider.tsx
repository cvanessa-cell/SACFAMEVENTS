"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type { UIConfig } from "@/lib/ui-config/schema";
import { DEFAULT_UI_CONFIG } from "@/lib/ui-config/defaults";

interface UIConfigContextValue {
  config: UIConfig;
  updateConfig: (partial: DeepPartial<UIConfig>) => void;
  resetConfig: () => void;
  isLoading: boolean;
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const UIConfigContext = createContext<UIConfigContextValue>({
  config: DEFAULT_UI_CONFIG,
  updateConfig: () => {},
  resetConfig: () => {},
  isLoading: true,
});

export function useUIConfig() {
  return useContext(UIConfigContext);
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: DeepPartial<T>,
): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const val = override[key];
    if (
      val !== undefined &&
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val) &&
      typeof base[key] === "object" &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(
        base[key] as Record<string, unknown>,
        val as DeepPartial<Record<string, unknown>>,
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

const CSS_VAR_MAP: Record<keyof UIConfig["theme"], string | null> = {
  mode: null,
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
  radius: "--radius",
  fontScale: null,
};

function applyThemeToDOM(theme: UIConfig["theme"]) {
  const root = document.documentElement;

  if (theme.mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    if (!cssVar) continue;
    const value = theme[key as keyof UIConfig["theme"]];
    if (typeof value === "string") {
      root.style.setProperty(cssVar, value);
    }
  }

  if (theme.fontScale !== 1) {
    root.style.setProperty("--font-scale", String(theme.fontScale));
    root.style.fontSize = `${theme.fontScale * 100}%`;
  } else {
    root.style.removeProperty("--font-scale");
    root.style.fontSize = "";
  }
}

export function UIConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<UIConfig>(DEFAULT_UI_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/ui-config")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        applyThemeToDOM(data.theme);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const persistConfig = useCallback((newConfig: UIConfig) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch("/api/ui-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      }).catch(() => {});
    }, 1000);
  }, []);

  const updateConfig = useCallback(
    (partial: DeepPartial<UIConfig>) => {
      setConfig((prev) => {
        const next = deepMerge(prev, partial) as UIConfig;
        applyThemeToDOM(next.theme);
        persistConfig(next);
        return next;
      });
    },
    [persistConfig],
  );

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_UI_CONFIG);
    applyThemeToDOM(DEFAULT_UI_CONFIG.theme);
    persistConfig(DEFAULT_UI_CONFIG);
  }, [persistConfig]);

  return (
    <UIConfigContext.Provider value={{ config, updateConfig, resetConfig, isLoading }}>
      {children}
    </UIConfigContext.Provider>
  );
}
