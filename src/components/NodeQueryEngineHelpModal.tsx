import HelpDialog from './help/HelpDialog';
import { queryHelp } from './help/helpContent';

interface Props {
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  /** No longer needed: the dialog follows the app's dark class. Kept so callers don't change. */
  appTheme?: string;
}

export default function NodeQueryEngineHelpModal({ showHelp, setShowHelp }: Props) {
  if (typeof document === 'undefined') return null;

  return <HelpDialog open={showHelp} onClose={() => setShowHelp(false)} content={queryHelp} />;
}
