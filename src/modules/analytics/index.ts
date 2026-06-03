import type { BeaconEvent, SessionRecord, WebsiteRule } from '../types';
import { hostMatches } from '../website-rules';

export interface DomainStat {
  domain: string;
  seconds: number;
  category: 'productive' | 'distracting' | 'neutral';
}

export interface DayOverview {
  dateKey: string;
  focusSeconds: number;
  distractionSeconds: number;
  neutralSeconds: number;
  sessionsCompleted: number;
  distractionEvents: number;
  blockedCount: number;
  focusRatio: number; // 0..1
  domains: DomainStat[];
}

export function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function categorize(
  domain: string,
  rules: WebsiteRule[]
): 'productive' | 'distracting' | 'neutral' {
  const match = (cat: WebsiteRule['category']) =>
    rules.some((r) => r.category === cat && hostMatches(domain, r.pattern));
  if (match('allowed')) return 'productive';
  if (match('blocked') || match('warning')) return 'distracting';
  return 'neutral';
}

/** Build an overview for a single day from raw events + completed sessions. */
export function buildDayOverview(
  day: number,
  events: BeaconEvent[],
  history: SessionRecord[],
  rules: WebsiteRule[]
): DayOverview {
  const key = dateKey(day);
  const dayEvents = events.filter((e) => dateKey(e.ts) === key);

  const domainMap = new Map<string, number>();
  let distractionEvents = 0;
  let blockedCount = 0;

  for (const e of dayEvents) {
    if (e.type === 'visit' && e.domain && e.seconds) {
      domainMap.set(e.domain, (domainMap.get(e.domain) ?? 0) + e.seconds);
    }
    if (e.type === 'blocked') {
      blockedCount += 1;
      distractionEvents += 1;
    }
    if (e.type === 'warned' || e.type === 'drift_nudge') distractionEvents += 1;
  }

  const domains: DomainStat[] = [...domainMap.entries()]
    .map(([domain, seconds]) => ({
      domain,
      seconds: Math.round(seconds),
      category: categorize(domain, rules),
    }))
    .sort((a, b) => b.seconds - a.seconds);

  let focusSeconds = 0;
  let distractionSeconds = 0;
  let neutralSeconds = 0;
  for (const d of domains) {
    if (d.category === 'productive') focusSeconds += d.seconds;
    else if (d.category === 'distracting') distractionSeconds += d.seconds;
    else neutralSeconds += d.seconds;
  }

  const sessionsCompleted = history.filter(
    (h) => h.status === 'completed' && dateKey(h.endedAt) === key
  ).length;

  const tracked = focusSeconds + distractionSeconds;
  const focusRatio = tracked > 0 ? focusSeconds / tracked : 0;

  return {
    dateKey: key,
    focusSeconds,
    distractionSeconds,
    neutralSeconds,
    sessionsCompleted,
    distractionEvents,
    blockedCount,
    focusRatio,
    domains,
  };
}

export interface RangeReport {
  label: string;
  totalFocusSeconds: number;
  totalDistractionSeconds: number;
  sessionsCompleted: number;
  avgSessionMinutes: number;
  mostProductiveDay: { dateKey: string; focusSeconds: number } | null;
  topProductive: DomainStat[];
  topDistracting: DomainStat[];
  perDay: DayOverview[];
}

/** Aggregate the last N days into a report (weekly = 7, monthly = 30). */
export function buildRangeReport(
  label: string,
  days: number,
  events: BeaconEvent[],
  history: SessionRecord[],
  rules: WebsiteRule[]
): RangeReport {
  const now = Date.now();
  const perDay: DayOverview[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(now - i * 86_400_000);
    perDay.push(buildDayOverview(day, events, history, rules));
  }

  const totalFocusSeconds = perDay.reduce((a, d) => a + d.focusSeconds, 0);
  const totalDistractionSeconds = perDay.reduce((a, d) => a + d.distractionSeconds, 0);

  const since = startOfDay(now - (days - 1) * 86_400_000);
  const rangeSessions = history.filter(
    (h) => h.status === 'completed' && h.endedAt >= since
  );
  const sessionsCompleted = rangeSessions.length;
  const avgSessionMinutes =
    sessionsCompleted > 0
      ? rangeSessions.reduce((a, s) => a + s.focusSeconds / 60, 0) / sessionsCompleted
      : 0;

  const mostProductiveDay = perDay.reduce<RangeReport['mostProductiveDay']>(
    (best, d) =>
      !best || d.focusSeconds > best.focusSeconds
        ? { dateKey: d.dateKey, focusSeconds: d.focusSeconds }
        : best,
    null
  );

  // Merge domains across the range.
  const merged = new Map<string, DomainStat>();
  for (const d of perDay) {
    for (const dom of d.domains) {
      const cur = merged.get(dom.domain);
      if (cur) cur.seconds += dom.seconds;
      else merged.set(dom.domain, { ...dom });
    }
  }
  const allDomains = [...merged.values()].sort((a, b) => b.seconds - a.seconds);

  return {
    label,
    totalFocusSeconds,
    totalDistractionSeconds,
    sessionsCompleted,
    avgSessionMinutes,
    mostProductiveDay,
    topProductive: allDomains.filter((d) => d.category === 'productive').slice(0, 8),
    topDistracting: allDomains.filter((d) => d.category === 'distracting').slice(0, 8),
    perDay,
  };
}

// ---- Live distraction detection (operates on recent events) ----

export interface DriftSignal {
  type: 'tab_thrash' | 'repeat_distraction';
  message: string;
}

/** Detect excessive tab switching within a recent window. */
export function detectTabThrash(
  events: BeaconEvent[],
  windowMs = 20 * 60_000,
  threshold = 40,
  now = Date.now()
): DriftSignal | null {
  const switches = events.filter(
    (e) => e.type === 'tab_switch' && now - e.ts <= windowMs
  ).length;
  if (switches >= threshold) {
    return {
      type: 'tab_thrash',
      message: `${switches} tab switches in ${Math.round(windowMs / 60000)} min — possible loss of focus.`,
    };
  }
  return null;
}

/** Detect frequent returns to the same distracting domain. */
export function detectRepeatDistraction(
  events: BeaconEvent[],
  windowMs = 60 * 60_000,
  threshold = 6,
  now = Date.now()
): DriftSignal | null {
  const counts = new Map<string, number>();
  for (const e of events) {
    if ((e.type === 'warned' || e.type === 'blocked') && e.domain && now - e.ts <= windowMs) {
      counts.set(e.domain, (counts.get(e.domain) ?? 0) + 1);
    }
  }
  for (const [domain, count] of counts) {
    if (count >= threshold) {
      return {
        type: 'repeat_distraction',
        message: `${domain} reached ${count} times in the last hour.`,
      };
    }
  }
  return null;
}

// ---- Export ----

export function exportJSON(data: {
  events: BeaconEvent[];
  history: SessionRecord[];
}): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), version: 1, ...data },
    null,
    2
  );
}

export function exportCSV(history: SessionRecord[]): string {
  const header = [
    'id',
    'goal',
    'type',
    'durationMinutes',
    'startedAt',
    'endedAt',
    'status',
    'focusSeconds',
    'distractionSeconds',
    'blockedCount',
    'warnedCount',
  ];
  const rows = history.map((h) =>
    [
      h.id,
      csvEscape(h.goal),
      h.type,
      h.durationMinutes,
      new Date(h.startedAt).toISOString(),
      new Date(h.endedAt).toISOString(),
      h.status,
      h.focusSeconds,
      h.distractionSeconds,
      h.blockedCount,
      h.warnedCount,
    ].join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
