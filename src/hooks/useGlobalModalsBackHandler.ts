import { useStore } from "../store/useStore";
import { useModalBackHandler } from "../utils/modalBackHandler";

interface GlobalModalsBackHandlerProps {
  isShareDialogOpen?: boolean;
  setIsShareDialogOpen?: (open: boolean) => void;
}

/**
 * Connects root and store-level modals with the native-like back button handler.
 * Automatically pushes modal states when any modal opens, and closes topmost modal
 * on back button click in strict LIFO order.
 */
export function useGlobalModalsBackHandler({
  isShareDialogOpen = false,
  setIsShareDialogOpen,
}: GlobalModalsBackHandlerProps = {}) {
  const isSavedDocsOpen = useStore((s) => s.isSavedDocsOpen);
  const setIsSavedDocsOpen = useStore((s) => s.setIsSavedDocsOpen);

  const isTemplateGalleryOpen = useStore((s) => s.isTemplateGalleryOpen);
  const setIsTemplateGalleryOpen = useStore((s) => s.setIsTemplateGalleryOpen);

  const isMathHelpOpen = useStore((s) => s.isMathHelpOpen);
  const setIsMathHelpOpen = useStore((s) => s.setIsMathHelpOpen);

  const isAdvancedPanelOpen = useStore((s) => s.isAdvancedPanelOpen);
  const setIsAdvancedPanelOpen = useStore((s) => s.setIsAdvancedPanelOpen);

  const isAISettingsPanelOpen = useStore((s) => s.isAISettingsPanelOpen);
  const setIsAISettingsPanelOpen = useStore((s) => s.setIsAISettingsPanelOpen);

  const isAIPaletteOpen = useStore((s) => s.isAIPaletteOpen);
  const setIsAIPaletteOpen = useStore((s) => s.setIsAIPaletteOpen);

  const isShortcutsOpen = useStore((s) => s.isShortcutsOpen);
  const setIsShortcutsOpen = useStore((s) => s.setIsShortcutsOpen);

  const isYoutubeSearchOpen = useStore((s) => s.isYoutubeSearchOpen);
  const setIsYoutubeSearchOpen = useStore((s) => s.setIsYoutubeSearchOpen);

  const isLearningGamesOpen = useStore((s) => s.isLearningGamesOpen);
  const setIsLearningGamesOpen = useStore((s) => s.setIsLearningGamesOpen);

  const isSqliteModalOpen = useStore((s) => s.isSqliteModalOpen);
  const setIsSqliteModalOpen = useStore((s) => s.setIsSqliteModalOpen);

  const isProxyModalOpen = useStore((s) => s.isProxyModalOpen);
  const setIsProxyModalOpen = useStore((s) => s.setIsProxyModalOpen);

  const pendingImport = useStore((s) => s.pendingImport);
  const setPendingImport = useStore((s) => s.setPendingImport);

  const activePreviewText = useStore((s) => s.activePreviewText);
  const setActivePreviewText = useStore((s) => s.setActivePreviewText);

  const activePreviewMedia = useStore((s) => s.activePreviewMedia);
  const setActivePreviewMedia = useStore((s) => s.setActivePreviewMedia);

  const isolatedNodeId = useStore((s) => s.isolatedNodeId);
  const setIsolatedNodeId = useStore((s) => s.setIsolatedNodeId);

  const expandedJsNodeId = useStore((s) => s.expandedJsNodeId);
  const setExpandedJsNodeId = useStore((s) => s.setExpandedJsNodeId);

  // Register each root-level modal with the modal stack
  useModalBackHandler(isSavedDocsOpen, () => setIsSavedDocsOpen(false), "saved-documents");
  useModalBackHandler(isTemplateGalleryOpen, () => setIsTemplateGalleryOpen(false), "template-gallery");
  useModalBackHandler(isMathHelpOpen, () => setIsMathHelpOpen(false), "math-help");
  useModalBackHandler(isAdvancedPanelOpen, () => setIsAdvancedPanelOpen(false), "advanced-panel");
  useModalBackHandler(isAISettingsPanelOpen, () => setIsAISettingsPanelOpen(false), "ai-settings");
  useModalBackHandler(isAIPaletteOpen, () => setIsAIPaletteOpen(false), "ai-palette");
  useModalBackHandler(isShortcutsOpen, () => setIsShortcutsOpen(false), "shortcuts");
  useModalBackHandler(isYoutubeSearchOpen, () => setIsYoutubeSearchOpen(false), "youtube-search");
  useModalBackHandler(isLearningGamesOpen, () => setIsLearningGamesOpen(false), "learning-games");
  useModalBackHandler(isSqliteModalOpen, () => setIsSqliteModalOpen(false), "sqlite-modal");
  useModalBackHandler(isProxyModalOpen, () => setIsProxyModalOpen(false), "proxy-settings");

  useModalBackHandler(
    isShareDialogOpen && !!setIsShareDialogOpen,
    () => setIsShareDialogOpen?.(false),
    "share-dialog"
  );

  useModalBackHandler(
    pendingImport !== null,
    () => setPendingImport(null),
    "import-modal"
  );

  useModalBackHandler(
    expandedJsNodeId !== null,
    () => setExpandedJsNodeId(null),
    "code-workspace"
  );

  useModalBackHandler(
    isolatedNodeId !== null,
    () => setIsolatedNodeId(null),
    "isolated-node"
  );

  useModalBackHandler(
    activePreviewText !== null,
    () => setActivePreviewText(null),
    "text-preview"
  );

  useModalBackHandler(
    activePreviewMedia !== null,
    () => setActivePreviewMedia(null),
    "media-preview"
  );
}
