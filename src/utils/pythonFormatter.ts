/**
 * Pure client-side Python Code Formatter and Indentation Repair Engine
 *
 * Provides PEP 8 standard formatting:
 * - Automatically fixes indentation errors (missing indents after block headers, mixed tabs/spaces, irregular step levels)
 * - Standardizes 4 spaces per indentation level
 * - Normalizes spacing around binary and assignment operators while respecting keyword args and slices
 * - Normalizes comma, colon, and bracket spacing
 * - Preserves 100% of comments (inline comments, block comments, docstrings)
 * - Registers a DocumentFormattingEditProvider with Monaco Editor for language: "python"
 */

export interface PythonFormatOptions {
  indentSize?: number;
  tabWidth?: number;
}

export function formatPythonCode(code: string, options: PythonFormatOptions = {}): string {
  if (!code || code.trim().length === 0) {
    return code;
  }

  const indentSize = options.indentSize || 4;
  const tabWidth = options.tabWidth || 4;

  const normalized = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");

  const formattedLines: string[] = [];
  let inMultilineString: string | null = null; // '"""' or "'''"
  let bracketDepth = 0;
  let indentStack: number[] = [0];
  let pendingBlockIndent = false;
  let blankCount = 0;
  let lastOrigIndent: number | null = null;
  let lastTargetIndent = 0;

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const rawLine = rawLines[lineIndex];

    // Handle multiline string state
    if (inMultilineString) {
      formattedLines.push(rawLine);
      if (rawLine.includes(inMultilineString)) {
        const closeIdx = rawLine.indexOf(inMultilineString);
        let bsCount = 0;
        for (let i = closeIdx - 1; i >= 0 && rawLine[i] === "\\"; i--) {
          bsCount++;
        }
        if (bsCount % 2 === 0) {
          inMultilineString = null;
        }
      }
      blankCount = 0;
      continue;
    }

    const trimmed = rawLine.trim();

    // Blank lines
    if (trimmed.length === 0) {
      if (blankCount < 2 && formattedLines.length > 0) {
        formattedLines.push("");
        blankCount++;
      }
      continue;
    }
    blankCount = 0;

    // Parse strings and comments in the line
    let codePart = "";
    let commentPart = "";
    let i = 0;
    let currentQuote: string | null = null;

    while (i < trimmed.length) {
      const ch = trimmed[i];
      const next3 = trimmed.slice(i, i + 3);

      if (!currentQuote) {
        if (next3 === '"""' || next3 === "'''") {
          currentQuote = next3;
          codePart += next3;
          i += 3;
          continue;
        } else if (ch === '"' || ch === "'") {
          currentQuote = ch;
          codePart += ch;
          i++;
          continue;
        } else if (ch === "#") {
          commentPart = trimmed.slice(i);
          break;
        } else {
          codePart += ch;
          i++;
        }
      } else if (currentQuote === '"""' || currentQuote === "'''") {
        if (next3 === currentQuote) {
          let bsCount = 0;
          for (let j = i - 1; j >= 0 && trimmed[j] === "\\"; j--) bsCount++;
          if (bsCount % 2 === 0) {
            codePart += next3;
            i += 3;
            currentQuote = null;
            continue;
          }
        }
        codePart += ch;
        i++;
      } else {
        if (ch === currentQuote) {
          let bsCount = 0;
          for (let j = i - 1; j >= 0 && trimmed[j] === "\\"; j--) bsCount++;
          if (bsCount % 2 === 0) {
            currentQuote = null;
          }
        }
        codePart += ch;
        i++;
      }
    }

    // If line ends with an unclosed multiline string
    if (currentQuote === '"""' || currentQuote === "'''") {
      inMultilineString = currentQuote;
    }

    // Count original leading spaces (expanding tabs)
    const rawLeading = rawLine.match(/^[ \t]*/)?.[0] || "";
    let origIndent = 0;
    for (const c of rawLeading) {
      origIndent += (c === "\t" ? tabWidth : 1);
    }

    const trimmedCode = codePart.trim();

    // Check bracket changes in codePart (ignoring string contents)
    let openBracketsInLine = 0;
    let closeBracketsInLine = 0;
    let inStr: string | null = null;
    for (let cIdx = 0; cIdx < codePart.length; cIdx++) {
      const char = codePart[cIdx];
      const three = codePart.slice(cIdx, cIdx + 3);
      if (!inStr) {
        if (three === '"""' || three === "'''") {
          inStr = three;
          cIdx += 2;
        } else if (char === '"' || char === "'") {
          inStr = char;
        } else if (char === "(" || char === "[" || char === "{") {
          openBracketsInLine++;
        } else if (char === ")" || char === "]" || char === "}") {
          closeBracketsInLine++;
        }
      } else if (inStr === '"""' || inStr === "'''") {
        if (three === inStr) {
          inStr = null;
          cIdx += 2;
        }
      } else if (char === inStr) {
        let bs = 0;
        for (let j = cIdx - 1; j >= 0 && codePart[j] === "\\"; j--) bs++;
        if (bs % 2 === 0) inStr = null;
      }
    }

    // Determine Indentation Level
    const startsWithDedent = /^(elif\b|else\b|except\b|finally\b)/.test(trimmedCode);
    const startsWithClosingBracket = /^[\)\]\}]/.test(trimmedCode);
    const isTopLevelDeclaration = /^(def\b|class\b|import\b|from\b|@|if __name__)/.test(trimmedCode);

    let targetIndent = 0;

    if (bracketDepth > 0) {
      // Inside multiline bracket expression
      if (startsWithClosingBracket) {
        bracketDepth = Math.max(0, bracketDepth - 1);
        targetIndent = indentStack[indentStack.length - 1];
      } else {
        targetIndent = indentStack[indentStack.length - 1] + indentSize;
      }
    } else {
      // Normal block or top-level code
      if (startsWithDedent) {
        // Dedent to match the parent block opener
        if (indentStack.length > 1) {
          indentStack.pop();
        }
        targetIndent = indentStack[indentStack.length - 1];
        pendingBlockIndent = false;
      } else if (pendingBlockIndent) {
        // First line inside a newly opened block: guarantee an indent step!
        const nextLevel = indentStack[indentStack.length - 1] + indentSize;
        indentStack.push(nextLevel);
        targetIndent = nextLevel;
        pendingBlockIndent = false;
      } else if (isTopLevelDeclaration && origIndent === 0) {
        // Reset to top level
        indentStack = [0];
        targetIndent = 0;
      } else if (lastOrigIndent !== null && origIndent === lastOrigIndent) {
        // Consecutive line with the same original indentation belongs to the same block level
        targetIndent = lastTargetIndent;
      } else if (lastOrigIndent !== null && origIndent < lastOrigIndent) {
        // User dedented: step down
        const stepDown = Math.max(1, Math.round((lastOrigIndent - origIndent) / 2));
        for (let s = 0; s < stepDown && indentStack.length > 1; s++) {
          indentStack.pop();
        }
        targetIndent = indentStack[indentStack.length - 1];
      } else {
        // Fallback to current stack top
        targetIndent = indentStack[indentStack.length - 1];
      }
    }

    lastOrigIndent = origIndent;
    lastTargetIndent = targetIndent;

    // Update bracket depth for subsequent lines
    bracketDepth += (openBracketsInLine - closeBracketsInLine);
    if (bracketDepth < 0) bracketDepth = 0;

    // Check if this line opens a new block (ends with ':' outside brackets)
    if (bracketDepth === 0 && trimmedCode.endsWith(":")) {
      pendingBlockIndent = true;
    }

    // Format codePart tokens (spacing around operators, commas, colons)
    const formattedCode = formatLineTokens(trimmedCode);

    // Format comment spacing
    let finalComment = "";
    if (commentPart.length > 0) {
      const commentText = commentPart.trim();
      if (
        commentText.startsWith("#") &&
        !commentText.startsWith("#!") &&
        !commentText.startsWith("#:") &&
        !commentText.startsWith("# coding") &&
        !commentText.startsWith("#type:")
      ) {
        const afterHash = commentText.slice(1).trimStart();
        finalComment = "# " + afterHash;
      } else {
        finalComment = commentText;
      }
    }

    const indentStr = " ".repeat(Math.max(0, targetIndent));
    if (formattedCode.length > 0) {
      if (finalComment.length > 0) {
        formattedLines.push(indentStr + formattedCode + "  " + finalComment);
      } else {
        formattedLines.push(indentStr + formattedCode);
      }
    } else if (finalComment.length > 0) {
      formattedLines.push(indentStr + finalComment);
    }
  }

  // Ensure clean trailing newline
  return formattedLines.join("\n") + "\n";
}

function formatLineTokens(code: string): string {
  if (!code) return "";

  // Split code into string literals and non-string code segments
  const segments: { isStr: boolean; text: string }[] = [];
  let i = 0;
  let currentQuote: string | null = null;
  let currentSegment = "";

  while (i < code.length) {
    const ch = code[i];
    const next3 = code.slice(i, i + 3);

    if (!currentQuote) {
      if (next3 === '"""' || next3 === "'''") {
        if (currentSegment) {
          segments.push({ isStr: false, text: currentSegment });
          currentSegment = "";
        }
        currentQuote = next3;
        currentSegment += next3;
        i += 3;
      } else if (ch === '"' || ch === "'") {
        if (currentSegment) {
          segments.push({ isStr: false, text: currentSegment });
          currentSegment = "";
        }
        currentQuote = ch;
        currentSegment += ch;
        i++;
      } else {
        currentSegment += ch;
        i++;
      }
    } else if (currentQuote === '"""' || currentQuote === "'''") {
      currentSegment += ch;
      if (next3 === currentQuote) {
        let bs = 0;
        for (let j = i - 1; j >= 0 && code[j] === "\\"; j--) bs++;
        if (bs % 2 === 0) {
          currentSegment += code.slice(i + 1, i + 3);
          segments.push({ isStr: true, text: currentSegment });
          currentSegment = "";
          currentQuote = null;
          i += 3;
          continue;
        }
      }
      i++;
    } else {
      currentSegment += ch;
      if (ch === currentQuote) {
        let bs = 0;
        for (let j = i - 1; j >= 0 && code[j] === "\\"; j--) bs++;
        if (bs % 2 === 0) {
          segments.push({ isStr: true, text: currentSegment });
          currentSegment = "";
          currentQuote = null;
        }
      }
      i++;
    }
  }

  if (currentSegment) {
    segments.push({ isStr: !!currentQuote, text: currentSegment });
  }

  // Format non-string segments according to PEP 8 standards
  return segments
    .map((seg) => {
      if (seg.isStr) return seg.text;
      return formatCodeSegment(seg.text);
    })
    .join("");
}

function formatCodeSegment(text: string): string {
  let s = text;

  // Commas: space after, no space before
  s = s.replace(/\s*,\s*/g, ", ");

  // Colons: clean extra space before colon
  s = s.replace(/\s+:/g, ":");

  // Format compound assignment and comparison operators
  s = s.replace(/\s*(\+=|-=|\*=|\/=|%=|\/\/=|\*\*=|&=|\|=|\^=|<<=|>>=|==|!=|<=|>=)\s*/g, " $1 ");

  // Single < and >
  s = s.replace(/\s*(<|>)\s*/g, " $1 ");

  // Single = assignment (not part of ==, !=, <=, >=, +=, etc.)
  s = s.replace(/([^!=<>+\-*/%&|^])\s*=\s*([^=])/g, "$1 = $2");

  // Arithmetic + and - (preserve identifiers/numbers/brackets)
  s = s.replace(/([a-zA-Z0-9_\)\]\}])\s*([+\-])\s*([a-zA-Z0-9_\(\[\{])/g, "$1 $2 $3");

  // Multiplication / Division / Modulo: * / % //
  s = s.replace(/([a-zA-Z0-9_\)\]\}])\s*(\*|\/|\/\/|%)\s*([a-zA-Z0-9_\(\[\{])/g, "$1 $2 $3");

  // Semicolons
  s = s.replace(/\s*;\s*/g, "; ");

  // Clean consecutive spaces
  s = s.replace(/ {2,}/g, " ");

  // Clean space before opening parentheses and brackets in function calls/indexing
  s = s.replace(/([a-zA-Z0-9_])\s+\(/g, "$1(");
  s = s.replace(/([a-zA-Z0-9_])\s+\[/g, "$1[");

  // Clean spaces immediately inside parentheses/brackets/braces
  s = s.replace(/\(\s+/g, "(");
  s = s.replace(/\s+\)/g, ")");
  s = s.replace(/\[\s+/g, "[");
  s = s.replace(/\s+\]/g, "]");
  s = s.replace(/\{\s+/g, "{");
  s = s.replace(/\s+\}/g, "}");

  // Slices: avoid extra spaces around colon inside brackets (e.g. [1:2], [:], [::2])
  s = s.replace(/\[([a-zA-Z0-9_]*)\s*:\s*([a-zA-Z0-9_]*)\]/g, "[$1:$2]");

  // Keyword argument spacing inside function calls/defs: PEP 8 says no space around '=' for kwargs
  s = s.replace(/\(([a-zA-Z0-9_]+)\s*=\s*/g, "($1=");
  s = s.replace(/,\s*([a-zA-Z0-9_]+)\s*=\s*/g, ", $1=");

  return s;
}

/**
 * Registers the Python document formatting provider with Monaco Editor
 */
export function registerPythonFormattingProvider(monaco: any): void {
  if (!monaco?.languages) return;

  if ((window as any).__pythonFormattingProviderRegistered) {
    return;
  }
  (window as any).__pythonFormattingProviderRegistered = true;

  try {
    monaco.languages.registerDocumentFormattingEditProvider("python", {
      provideDocumentFormattingEdits(model: any) {
        try {
          const original = model.getValue();
          const formatted = formatPythonCode(original);

          if (formatted === original) {
            return [];
          }

          return [
            {
              range: model.getFullModelRange(),
              text: formatted,
            },
          ];
        } catch (err) {
          console.warn("[PythonFormatter]: Failed to format document", err);
          return [];
        }
      },
    });
  } catch (err) {
    console.warn("Could not register Python DocumentFormattingEditProvider in Monaco", err);
  }
}
