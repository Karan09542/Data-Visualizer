import { useStore } from '../store/useStore';

interface TerminalInputPromptProps {
  path: string;
}

export function TerminalInputPrompt({ path }: TerminalInputPromptProps) {
  const activePrompt = useStore(state => state.activePrompts[path]);

  if (!activePrompt) return null;

  // Returning null here completely avoids double input boxes and redundant clunky alert-styling,
  // as the global terminal CLI at the bottom of the console is now natively hijacked to accept prompt responses.
  return null;
}
