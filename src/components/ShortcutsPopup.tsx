import { useStore } from '../store/useStore';
import HelpDialog from './help/HelpDialog';
import { shortcutsHelp } from './help/helpContent';

export default function ShortcutsPopup() {
  const isShortcutsOpen = useStore((state) => state.isShortcutsOpen);
  const setIsShortcutsOpen = useStore((state) => state.setIsShortcutsOpen);

  return (
    <HelpDialog
      open={isShortcutsOpen}
      onClose={() => setIsShortcutsOpen(false)}
      content={shortcutsHelp}
    />
  );
}
