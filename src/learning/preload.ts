/**
 * Eager preloader for Learning Games bundle and store.
 * Allows the panel to open in 0ms when the user clicks 'Learn'.
 */
let preloadPromise: Promise<any> | null = null;
export let isLearningChunkLoaded = false;
export let fallbackWasShown = false;

export function setFallbackWasShown(val: boolean) {
  fallbackWasShown = val;
}

export function preloadLearningGames() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      import("./components/LearningGamesPanel").then(() => {
        isLearningChunkLoaded = true;
      }),
      import("./store/useLearningStore").then(async (m) => {
        try {
          await m.useLearningStore.getState().init();
        } catch (e) {
          console.warn("[learning] eager init error:", e);
        }
      }),
    ]).catch((err) => {
      console.warn("[learning] preload failed:", err);
      preloadPromise = null; // allow retry
    });
  }
  return preloadPromise;
}
