/**
 * Turns an everyday query into one Wikipedia's search actually answers well.
 *
 * People type the way they type into Google — "who invented the telephone", "tallest mountain
 * in the world" — but Wikipedia runs CirrusSearch, which matches keywords literally. Question
 * words and filler are treated as real search terms, so the obvious article is pushed down the
 * list or missed entirely, which is why a search that works on Google seems to fail here.
 *
 * The syntax used below is documented at https://en.wikipedia.org/wiki/Help:Searching
 */

/** Operators that mean the person is writing CirrusSearch themselves, so nothing is rewritten */
const ADVANCED_OPERATORS = [
  'intitle:', 'insource:', 'incategory:', 'deepcat:', 'deepcategory:', 'prefix:',
  'hastemplate:', 'linksto:', 'subpageof:', 'articletopic:', 'filetype:', 'filemime:',
  'morelike:', 'all:', 'local:', 'neartitle:', 'boost-templates:',
];

/**
 * Openings that carry no keyword value. Longest first, so "what is the" is taken off before
 * "what is". Wikipedia has no article containing the word "who" that anyone means to find.
 */
const QUESTION_OPENERS = [
  'who is the', 'who was the', 'who are the', 'who were the',
  'what is the', 'what was the', 'what are the', 'what were the',
  'where is the', 'where was the', 'where are the',
  'when is the', 'when was the', 'when did the',
  'why is the', 'why was the', 'why do the',
  'how is the', 'how was the', 'how do the', 'how does the', 'how to',
  'tell me about', 'give me', 'show me', 'search for', 'look up',
  'who is', 'who was', 'who are', 'who were',
  'what is', 'what was', 'what are', 'what were', 'what does', 'what do',
  'where is', 'where was', 'where are', 'when is', 'when was', 'when did',
  'why is', 'why was', 'why do', 'why does',
  'how is', 'how was', 'how do', 'how does', 'how many', 'how much',
  'define', 'search wikipedia for',
];

/** Filler that adds nothing but drags the ranking around */
const TRAILING_FILLER = [
  'in the world', 'in world', 'on earth', 'of all time', 'ever', 'please',
  'wikipedia', 'wiki',
];

/** Words too common to help, dropped only when something else survives */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'is', 'are',
  'was', 'were', 'be', 'been', 'do', 'does', 'did', 'it', 'its', 'this', 'that',
]);

export const hasAdvancedSyntax = (query: string) => {
  const lower = query.toLowerCase();
  if (ADVANCED_OPERATORS.some((op) => lower.includes(op))) return true;
  // Quotes, negation and OR all mean a deliberately built query
  return /"/.test(query) || /(^|\s)-\S/.test(query) || /\bOR\b/.test(query);
};

/**
 * Strips the conversational wrapper, leaving the words worth searching for.
 * Returns the original when stripping would leave nothing.
 */
export const normalizeQuery = (query: string): string => {
  let text = query.trim().replace(/\s+/g, ' ').replace(/[?!]+$/, '').trim();
  if (!text) return '';

  const lower = text.toLowerCase();
  for (const opener of QUESTION_OPENERS) {
    if (lower.startsWith(opener + ' ')) {
      text = text.slice(opener.length).trim();
      // 'who invented the telephone' leaves 'the telephone'; the article adds nothing here,
      // though one the person typed themselves, as in 'The Beatles', is left alone
      text = text.replace(/^(a|an|the)\s+/i, '');
      break;
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    const tail = text.toLowerCase();
    for (const filler of TRAILING_FILLER) {
      if (tail.endsWith(' ' + filler)) {
        text = text.slice(0, text.length - filler.length - 1).trim();
        changed = true;
        break;
      }
    }
  }

  return text || query.trim();
};

/** The same thing again with common words dropped, for the title attempt */
export const keywordsOnly = (query: string): string => {
  const words = normalizeQuery(query).split(' ').filter(Boolean);
  const kept = words.filter((word) => !STOPWORDS.has(word.toLowerCase()));
  return (kept.length > 0 ? kept : words).join(' ');
};

export type SearchTab = 'All' | 'People' | 'Places' | string;

/**
 * articletopic: takes a fixed vocabulary, so the tabs map onto real topics rather than the old
 * trick of gluing the words "person" and "location" onto the query, which simply searched for
 * those words.
 */
const TAB_TOPIC: Record<string, string> = {
  People: 'biography',
  Places: 'geography',
};

export interface SearchPlan {
  /** What goes to the API */
  query: string;
  /** What the person typed */
  original: string;
  /** True when the query was rewritten, so the UI can say so */
  wasRewritten: boolean;
  /** A title-first query, run alongside the main one to surface the obvious article */
  titleQuery: string | null;
  /** Worth an opensearch lookup: short queries are usually the name of a thing */
  useTitleLookup: boolean;
}

export const buildSearchPlan = (rawQuery: string, tab: SearchTab = 'All'): SearchPlan => {
  const original = rawQuery.trim();

  // A hand-written query is passed through exactly as typed
  if (hasAdvancedSyntax(original)) {
    return { query: original, original, wasRewritten: false, titleQuery: null, useTitleLookup: false };
  }

  const normalized = normalizeQuery(original);
  const keywords = keywordsOnly(original);
  const topic = TAB_TOPIC[tab];

  const query = topic ? `${normalized} articletopic:${topic}` : normalized;
  // The phrase keeps its small words: intitle:"history of rome" matches History of Rome,
  // while intitle:"history rome" matches nothing at all
  const titleQuery = normalized ? `intitle:"${normalized.replace(/"/g, '')}"` : null;

  return {
    query,
    original,
    wasRewritten: normalized.toLowerCase() !== original.toLowerCase(),
    titleQuery,
    // Long queries are rarely a title, so the extra request is skipped
    useTitleLookup: keywords.split(' ').length <= 6,
  };
};

/** Each word made fuzzy, which Wikipedia allows up to two characters out */
export const fuzzyQuery = (query: string): string =>
  normalizeQuery(query)
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length > 3 && !word.endsWith('~') ? `${word}~` : word))
    .join(' ');

export interface TitleSuggestion {
  title: string;
  description?: string;
}

/**
 * The lookup behind Wikipedia's own search box. It is the part that behaves like Google:
 * typing "telephone" returns the article Telephone, rather than every page mentioning it.
 */
export const fetchTitleMatches = async (
  query: string,
  language: string,
  limit = 5,
): Promise<TitleSuggestion[]> => {
  const url =
    `https://${language}.wikipedia.org/w/api.php?action=opensearch` +
    `&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json&origin=*`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const titles: string[] = data?.[1] || [];
    const descriptions: string[] = data?.[2] || [];
    return titles.map((title, i) => ({ title, description: descriptions[i] }));
  } catch {
    return [];
  }
};

/**
 * Keeps only a title match that really is the article being asked for.
 *
 * The prefix lookup is generous: searching "telephone" also returns "Telephone numbers in
 * the United Kingdom". Promoting those to the top would bury the full-text results, so a
 * match counts only when the title is the query itself.
 */
export const exactTitleMatches = <T extends { title: string }>(matches: T[], query: string): T[] => {
  const wanted = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!wanted) return [];
  return matches.filter(
    (match) => match.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === wanted,
  );
};

/**
 * Puts the articles whose titles matched at the top, the way a search engine leads with the
 * page you meant, then the rest of the full-text hits with nothing repeated.
 */
export const mergeByTitle = <T extends { title: string }>(leading: T[], rest: T[]): T[] => {
  const seen = new Set(leading.map((hit) => hit.title.toLowerCase()));
  return [...leading, ...rest.filter((hit) => !seen.has(hit.title.toLowerCase()))];
};

/** Wikipedia editions offered in the search bar. Lives here so the UI can be swapped freely. */
export const WIKI_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "sa", name: "संस्कृतम् (Sanskrit)" },
  { code: "ta", name: "தமிழ் (Tamil)" },
  { code: "te", name: "తెలుగు (Telugu)" },
  { code: "mr", name: "मराठी (Marathi)" },
  { code: "gu", name: "ગુજરાતી (Gujarati)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "zh", name: "中文 (Chinese)" },
  { code: "ru", name: "Русский (Russian)" },
];

/** Sections Wikipedia appends to most articles that are never worth inserting as a note. */
const BOILERPLATE = new Set([
  "references", "external links", "see also", "notes", "bibliography",
  "further reading", "sources", "citations", "footnotes", "gallery",
]);

export interface ArticleSection {
  title: string;
  /** 2 for a top-level heading, higher for nested ones. */
  level: number;
  text: string;
}

/**
 * Splits a plain-text extract into its headings.
 *
 * The extracts API returns one string with wiki headings left in (== Like This ==), which is
 * easier to work with than parsing HTML, and costs one request rather than one per section.
 */
export const splitSections = (extract: string): ArticleSection[] => {
  const out: ArticleSection[] = [{ title: "Summary", level: 2, text: "" }];
  let current = out[0];

  for (const line of extract.split("\n")) {
    const heading = line.match(/^(={2,6})\s*(.+?)\s*\1$/);
    if (heading) {
      current = { title: heading[2], level: heading[1].length, text: "" };
      out.push(current);
    } else {
      current.text += line + "\n";
    }
  }

  return out
    .map((s) => ({ ...s, text: s.text.trim() }))
    .filter((s) => s.text.length > 0 && !BOILERPLATE.has(s.title.toLowerCase()));
};
