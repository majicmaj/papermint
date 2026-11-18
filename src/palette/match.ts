import type { Range } from './types';

export interface TitleMatch {
  score: number;
  ranges: Range[];
}

const WORD_START = /[\s\-_/.(),:;]/;

function isWordStart(text: string, index: number): boolean {
  return index === 0 || WORD_START.test(text.charAt(index - 1));
}

function findWordStart(text: string, token: string): number {
  let from = 0;
  for (;;) {
    const index = text.indexOf(token, from);
    if (index < 0 || isWordStart(text, index)) return index;
    from = index + 1;
  }
}

/** Typo-tolerant match: letters in order, starting at a word start, within a short span. */
function subsequence(text: string, token: string): Range[] | null {
  const ranges: Range[] = [];
  let at = 0;
  for (const char of token) {
    const index = text.indexOf(char, at);
    if (index < 0) return null;
    ranges.push([index, index + 1]);
    at = index + 1;
  }
  const first = ranges[0]?.[0] ?? 0;
  const last = ranges[ranges.length - 1]?.[1] ?? 0;
  return isWordStart(text, first) && last - first <= token.length + 2 ? ranges : null;
}

export function mergeRanges(ranges: readonly Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

function matchToken(text: string, token: string): { score: number; ranges: Range[] } | null {
  const word = findWordStart(text, token);
  if (word === 0) return { score: 100, ranges: [[0, token.length]] };
  if (word > 0) return { score: 80, ranges: [[word, word + token.length]] };
  const inner = text.indexOf(token);
  if (inner >= 0) return { score: 50, ranges: [[inner, inner + token.length]] };
  if (token.length < 4) return null;
  const fuzzy = subsequence(text, token);
  return fuzzy ? { score: 15, ranges: fuzzy } : null;
}

/** Match every whitespace-separated token against the title. Returns null if any token misses. */
export function matchTitle(title: string, query: string): TitleMatch | null {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { score: 0, ranges: [] };
  const text = title.toLowerCase();
  let score = 0;
  const ranges: Range[] = [];
  for (const token of tokens) {
    const hit = matchToken(text, token);
    if (!hit) return null;
    score += hit.score;
    ranges.push(...hit.ranges);
  }
  // Shorter titles win ties: the query covers more of the title.
  score += Math.max(0, 20 - title.length / 8);
  return { score, ranges: mergeRanges(ranges) };
}
