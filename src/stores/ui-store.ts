import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type AiStudioTab = "self" | "seeking";

type UiStore = {
  aiStudioOpen: boolean;
  aiStudioTab: AiStudioTab;
  theme: ThemeMode;
  setAiStudioOpen: (open: boolean) => void;
  setAiStudioTab: (tab: AiStudioTab) => void;
  toggleAiStudio: () => void;
  setTheme: (theme: ThemeMode) => void;
};

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      aiStudioOpen: true,
      aiStudioTab: "self",
      theme: "dark",
      setAiStudioOpen: (open) => set({ aiStudioOpen: open }),
      setAiStudioTab: (tab) => set({ aiStudioTab: tab }),
      toggleAiStudio: () => set((s) => ({ aiStudioOpen: !s.aiStudioOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "mutual-ui-v2",
      partialize: (s) => ({ theme: s.theme, aiStudioOpen: s.aiStudioOpen }),
    },
  ),
);
