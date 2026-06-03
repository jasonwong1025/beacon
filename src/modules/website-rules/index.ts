import type { WebsiteRule, RuleCategory, SmartModeConfig } from '../types';

export type Decision = 'allow' | 'warn' | 'block';

export interface RuleVerdict {
  decision: Decision;
  /** The rule/host that matched, for display. */
  matchedHost?: string;
  reason?: string;
}

/** Normalize a user-entered pattern into a bare, lowercased host. */
export function normalizePattern(input: string): string {
  let s = input.trim().toLowerCase();
  if (!s) return '';
  // Strip protocol + path if a full URL was pasted.
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.split('/')[0];
  s = s.split('?')[0];
  s = s.split('#')[0];
  return s;
}

/** Get a clean hostname (no www) from a URL string. */
export function hostFromUrl(url: string): string | null {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** True if `host` equals `pattern` or is a subdomain of it. */
export function hostMatches(host: string, pattern: string): boolean {
  if (!host || !pattern) return false;
  return host === pattern || host.endsWith(`.${pattern}`);
}

/** Only http(s) pages are subject to rules; extension/chrome pages are exempt. */
export function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

const SMART_YOUTUBE_ALLOW = ['/watch', '/results'];
const SMART_YOUTUBE_RESTRICT = ['/shorts', '/feed', '/trending', '/gaming'];

const SMART_REDDIT_ALLOW = ['/r/', '/search'];
const SMART_REDDIT_WARN = ['/', '/popular', '/all', '/best', '/hot'];

function smartYouTubeVerdict(pathname: string): Decision | null {
  if (SMART_YOUTUBE_RESTRICT.some((p) => pathname.startsWith(p))) return 'warn';
  if (SMART_YOUTUBE_ALLOW.some((p) => pathname.startsWith(p))) return 'allow';
  // Home feed ("/") is the rabbit hole.
  if (pathname === '/' || pathname === '') return 'warn';
  return null;
}

function smartRedditVerdict(pathname: string): Decision | null {
  if (SMART_REDDIT_ALLOW.some((p) => pathname.startsWith(p))) return 'allow';
  if (SMART_REDDIT_WARN.includes(pathname)) return 'warn';
  return null;
}

/**
 * Classify a URL against the rule set + smart modes.
 * Precedence: smart-mode override > allowed > blocked > warning > default allow.
 */
export function classify(
  url: string,
  rules: WebsiteRule[],
  smart: SmartModeConfig
): RuleVerdict {
  if (!isWebUrl(url)) return { decision: 'allow' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { decision: 'allow' };
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const path = parsed.pathname || '/';

  // Smart YouTube
  if (smart.youtube && hostMatches(host, 'youtube.com')) {
    const v = smartYouTubeVerdict(path);
    if (v) {
      return {
        decision: v,
        matchedHost: 'youtube.com',
        reason: v === 'allow' ? 'Smart YouTube: tutorial/search' : 'Smart YouTube: feed/shorts',
      };
    }
  }

  // Smart Reddit
  if (smart.reddit && hostMatches(host, 'reddit.com')) {
    const v = smartRedditVerdict(path);
    if (v) {
      return {
        decision: v,
        matchedHost: 'reddit.com',
        reason: v === 'allow' ? 'Smart Reddit: subreddit/search' : 'Smart Reddit: popular feed',
      };
    }
  }

  // Find the most specific matching rule per category.
  const matched = (category: RuleCategory) =>
    rules
      .filter((r) => r.category === category && hostMatches(host, r.pattern))
      // Longest pattern wins (most specific).
      .sort((a, b) => b.pattern.length - a.pattern.length)[0];

  const allowed = matched('allowed');
  const blocked = matched('blocked');
  const warning = matched('warning');

  if (allowed) return { decision: 'allow', matchedHost: allowed.pattern };
  if (blocked)
    return { decision: 'block', matchedHost: blocked.pattern, reason: 'On your block list' };
  if (warning)
    return { decision: 'warn', matchedHost: warning.pattern, reason: 'On your warning list' };

  return { decision: 'allow' };
}
