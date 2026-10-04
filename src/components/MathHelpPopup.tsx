import React, { useCallback } from 'react';
import { Plus } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import HelpDialog from './help/HelpDialog';
import { mathHelp, type MathInsert } from './help/mathHelpContent';

interface MathHelpPopupProps {
  isOpen: boolean;
  onClose: () => void;
  /** Given when opened from a graph: examples then offer "Insert", which adds them as rows */
  onInsertFormula?: (formula: MathInsert) => void;
}

/** Typeset LaTeX for the guide's previews; bad input shows as plain text rather than failing */
const renderLatex = (latex: string) => (
  <span dangerouslySetInnerHTML={{ __html: katex.renderToString(latex, { throwOnError: false, displayMode: false }) }} />
);

/** Above the math editor, which goes fullscreen and opens its own overlays up to z-index 100000 */
const Z_INDEX = 100500;

const MathHelpPopup: React.FC<MathHelpPopupProps> = ({ isOpen, onClose, onInsertFormula }) => {
  const runInsert = useCallback((payload: unknown) => onInsertFormula?.(payload as MathInsert), [onInsertFormula]);

  return (
    <HelpDialog
      open={isOpen}
      onClose={onClose}
      content={mathHelp}
      renderPreview={renderLatex}
      exampleAction={onInsertFormula ? { label: 'Insert', icon: Plus, onRun: runInsert } : undefined}
      zIndex={Z_INDEX}
    />
  );
};

export default MathHelpPopup;
