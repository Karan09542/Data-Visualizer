import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AssistantItem {
  id: string;
  label: string;
  insertText: string;
  isSnippet?: boolean;
  kind?: string;
  category?: string;
}

interface AssistantState {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;

  recentItems: AssistantItem[];
  addRecent: (item: AssistantItem) => void;

  favoriteItems: AssistantItem[];
  addFavorite: (item: AssistantItem) => void;
  removeFavorite: (id: string) => void;

  isVisible: boolean;
  setIsVisible: (v: boolean) => void;

  isEnabled: boolean;
  setIsEnabled: (v: boolean) => void;
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set) => ({
      activeCategory: "Common",
      setActiveCategory: (cat) => set({ activeCategory: cat }),

      recentItems: [],
      addRecent: (item) =>
        set((state) => {
          const filtered = state.recentItems.filter((i) => i.id !== item.id);
          return { recentItems: [item, ...filtered].slice(0, 20) };
        }),

      favoriteItems: [],
      addFavorite: (item) =>
        set((state) => {
          if (state.favoriteItems.find((i) => i.id === item.id)) return state;
          return { favoriteItems: [...state.favoriteItems, item] };
        }),
      removeFavorite: (id) =>
        set((state) => ({
          favoriteItems: state.favoriteItems.filter((i) => i.id !== id),
        })),

      isVisible: false,
      setIsVisible: (v) => set({ isVisible: v }),

      isEnabled: true,
      setIsEnabled: (v) => set({ isEnabled: v }),
    }),
    {
      name: "programming-assistant-store",
      partialize: (state) => ({
        recentItems: state.recentItems,
        favoriteItems: state.favoriteItems,
        isVisible: state.isVisible,
        isEnabled: state.isEnabled,
      }),
    },
  ),
);
