export type HistoryEntryType = "article" | "image" | "gallery" | "search";

export interface HistoryEntry {
  type: HistoryEntryType;
  id: string; // title for article, src/id for image
  title: string; // display title
  data?: any; // full article data or image data
  scrollPosition: number;
  state?: any;
}

export interface NavigationState {
  stack: HistoryEntry[];
  currentIndex: number;
}
