/**
 * HTML documents a run printed - `console.log(await res.text())`, `print(r.text)` - found in its
 * console output so the Preview tab can render them instead of showing the markup as text.
 */
import { useEffect, useState } from "react";
import { getLogCount, loadLogsOffset } from "./executionStore";

export interface HtmlOutput {
  /** Stable while the output exists: the index of the log it starts at, or "result". */
  id: string;
  html: string;
  /** When it was printed, as the log recorded it. */
  time?: string;
  source: "console" | "result";
}

/** Only the end of a long console is searched; earlier pages are rarely the ones wanted. */
const SCAN_LOGS = 2000;
/** A document split over lines (Python prints line by line) is joined for at most this many. */
const MAX_JOINED_LINES = 20000;
const MAX_HTML_CHARS = 8 * 1024 * 1024;

const DOCUMENT_START = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\s+html|<html[\s>])/i;
const DOCUMENT_END = /<\/html>\s*$/i;

/** Whether text is an HTML document, not just a string that happens to contain a tag. */
export function looksLikeHtml(text: unknown): boolean {
  if (typeof text !== "string" || text.length < 15) return false;
  if (DOCUMENT_START.test(text)) return true;
  // A page without a doctype or <html>: a body that is a whole document on its own.
  return /^\s*</.test(text) && /<body[\s>]/i.test(text) && /<\/body>/i.test(text);
}

const textOf = (log: any): string | null =>
  log && Array.isArray(log.args) && log.args.length === 1 && typeof log.args[0] === "string" ? log.args[0] : null;

/** Finds the documents among logs, oldest first. */
export function findHtmlInLogs(logs: any[]): HtmlOutput[] {
  const found: HtmlOutput[] = [];
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (!log || log.type === "error") continue;
    const text = textOf(log);
    if (text === null) continue;

    // One line that opens a document without closing it: the start of a page printed line by
    // line, as Python's print() reaches the console. Joined up to </html>.
    if (DOCUMENT_START.test(text) && !text.includes("\n") && !DOCUMENT_END.test(text)) {
      const end = joinedDocumentEnd(logs, i);
      if (end > i) {
        const html = logs.slice(i, end + 1).map(textOf).join("\n");
        found.push({ id: String(log.index), html, time: log.time, source: "console" });
        i = end;
        continue;
      }
    }

    if (looksLikeHtml(text)) {
      found.push({ id: String(log.index), html: text, time: log.time, source: "console" });
    }
  }
  return found;
}

/**
 * Where a document that starts at logs[start] ends: the line holding </html>, among the plain
 * string lines of the same kind that follow. -1 when there is none - then it was not a split
 * page after all, and the lines after it are left alone.
 */
function joinedDocumentEnd(logs: any[], start: number): number {
  let size = 0;
  for (let j = start + 1; j < logs.length && j - start < MAX_JOINED_LINES && size < MAX_HTML_CHARS; j++) {
    const next = textOf(logs[j]);
    if (next === null || logs[j].type !== logs[start].type) return -1;
    if (DOCUMENT_END.test(next)) return j;
    size += next.length + 1;
  }
  return -1;
}

/** The HTML documents a file's run printed, kept up to date as its console changes. */
export function useHtmlOutputs(path: string, result: unknown): HtmlOutput[] {
  const [fromLogs, setFromLogs] = useState<HtmlOutput[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scan = async () => {
      try {
        const { logCount, startOffset } = await getLogCount(path);
        const from = Math.max(startOffset, logCount - SCAN_LOGS);
        const logs = logCount > from ? await loadLogsOffset(path, from, logCount - from) : [];
        if (!cancelled) setFromLogs(findHtmlInLogs(logs));
      } catch {
        if (!cancelled) setFromLogs([]);
      }
    };
    // Output arrives in bursts; one scan once a burst settles.
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(scan, 250);
    };
    const cleared = () => {
      if (timer) clearTimeout(timer);
      setFromLogs([]);
    };

    scan();
    window.addEventListener(`logs-appended-${path}`, schedule);
    window.addEventListener(`logs-cleared-${path}`, cleared);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(`logs-appended-${path}`, schedule);
      window.removeEventListener(`logs-cleared-${path}`, cleared);
    };
  }, [path]);

  return typeof result === "string" && looksLikeHtml(result)
    ? [...fromLogs, { id: "result", html: result, source: "result" }]
    : fromLogs;
}

/**
 * The address a page came from, when it says so itself: its canonical link or og:url. Relative
 * links and images resolve against it.
 */
export function detectBaseUrl(html: string): string {
  const head = html.slice(0, 200_000);
  const patterns = [
    /<base[^>]+href\s*=\s*["']([^"']+)["']/i,
    /<link[^>]+rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["']/i,
    /<meta[^>]+property\s*=\s*["']og:url["'][^>]*content\s*=\s*["']([^"']+)["']/i,
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:url["']/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(head)?.[1];
    if (match && /^https?:\/\//i.test(match)) return match;
  }
  return "";
}

/**
 * The document as the preview loads it: relative URLs resolve against `baseUrl`, and links open
 * in a new tab rather than replacing the preview.
 */
export function prepareHtml(html: string, baseUrl: string): string {
  const safeBase = /^https?:\/\//i.test(baseUrl) ? baseUrl.replace(/"/g, "&quot;") : "";
  const base = `<base ${safeBase ? `href="${safeBase}" ` : ""}target="_blank">`;
  // The first <base> wins, so it goes before any the page has.
  if (/<head[\s>]/i.test(html)) return html.replace(/<head(\s[^>]*)?>/i, (tag) => tag + base);
  if (/<html[\s>]/i.test(html)) return html.replace(/<html(\s[^>]*)?>/i, (tag) => `${tag}<head>${base}</head>`);
  return base + html;
}
