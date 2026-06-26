import React from "react";

interface CaretOverlayProps {
  value: string;
  cursorPos: number;
  isFocused: boolean;
  getColoredText: () => React.ReactNode;
}

export const CaretOverlay: React.FC<CaretOverlayProps> = ({
  value,
  cursorPos,
  isFocused,
  getColoredText,
}) => {
  if (!isFocused) return null;

  const beforeCursor = value.slice(0, cursorPos);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Invisible text up to the cursor to position the caret */}
      <div className="absolute inset-0 px-2 py-1.5 font-mono text-sm whitespace-pre-wrap break-all overflow-hidden text-transparent">
        <span>{beforeCursor}</span>
        <span className="inline-block w-[2px] h-[1.2em] bg-blue-500 animate-pulse align-middle -ml-[1px] mb-[2px]" />
      </div>
    </div>
  );
};
