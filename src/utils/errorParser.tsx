import React from 'react';

/**
 * Parses error messages and returns React element parts.
 * Scans for common pattern signatures of line and column parameters, converting them into clickable focus triggers.
 * E.g., "(Line 1, Col 7)", "[Ln 2]", "at js:4:1", "Line 4"
 */
export function renderClickableErrorText(
  text: string | null | undefined,
  path: string,
  setJsNodeFocusLine: (path: string | null, line?: number, col?: number) => void
): React.ReactNode {
  if (!text) return null;

  // Pattern combinations:
  // 1. (Line 1, Col 7) or (Line 1, Col: 7) or (Line 1, Col 7)
  // 2. Line 1
  // 3. [Ln 2]
  // 4. at js:2:1 or at config:10:5
  const regex = /(Line\s+(\d+),\s+Col\s+(\d+))|(Line\s+(\d+))|(\[Ln\s+(\d+)\])|((?:[a-zA-Z0-9_\-]+):(\d+):(\d+))/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchStr = match[0];

    // Push preceding text part
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // Determine line and col numbers
    let line: number | null = null;
    let col: number | null = null;

    if (match[2]) {
      // (Line 1, Col 7) -> Group 2 is line, Group 3 is col
      line = parseInt(match[2], 10);
      col = parseInt(match[3], 10);
    } else if (match[5]) {
      // (Line 4)
      line = parseInt(match[5], 10);
    } else if (match[7]) {
      // [Ln 2]
      line = parseInt(match[7], 10);
    } else if (match[9]) {
      // js:2:1
      line = parseInt(match[9], 10);
      col = parseInt(match[10], 10);
    }

    if (line !== null && !isNaN(line)) {
      const finalLine = line;
      const finalCol = col !== null && !isNaN(col) ? col : 1;
      parts.push(
        <span
          key={`link-${matchIndex}`}
          onClick={(e) => {
            e.stopPropagation();
            setJsNodeFocusLine(path, finalLine, finalCol);
          }}
          className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold bg-blue-100/50 dark:bg-blue-500/10 hover:bg-blue-200/50 dark:hover:bg-blue-500/20 px-1 rounded transition-colors select-none cursor-pointer inline-block"
          title={`Go to Line ${finalLine}, Col ${finalCol}`}
        >
          {matchStr}
        </span>
      );
    } else {
      parts.push(matchStr);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts.length > 0 ? parts : text}</>;
}
