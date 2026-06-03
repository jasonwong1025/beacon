// Shared domain types for Beacon.

export type SessionType =
  | 'work'
  | 'study'
  | 'coding'
  | 'research'
  | 'reading'
  | 'custom';

export const SESSION_TYPES: { value: SessionType; label: string; emoji: string }[] = [
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'study', label: 'Study', emoji: '📚' },
  { value: 'coding', label: 'Coding', emoji: '💻' },
  { value: 'research', label: 'Research', emoji: '🔬' },
  { value: 'reading', label: 'Reading', emoji: '📖' },
  { value: 'custom', label: 'Custom', emoji: '✨' },
];

export type RuleCategory = 'blocked' | 'warning' | 'allowed';

/** A website matching rule. `pattern` is a bare host (e.g. "instagram.com"). */
export interface WebsiteRule {
  id: string;
  pattern: string;
  category: RuleCategory;
  createdAt: number;
}

export interface SmartModeConfig {
  /** Smart YouTube: allow /watch and /results, restrict shorts/feed/trending. */
  youtube: boolean;
  /** Smart Reddit: allow subreddits & search, warn on the popular feed. */
  reddit: boolean;
}

export interface PomodoroConfig {
  enabled: boolean;
  focusMinutes: number;
  breakMinutes: number;
}

export interface Settings {
  pomodoro: PomodoroConfig;
  /** Show an intent-check prompt on warning sites instead of a plain warning. */
  intentCheck: boolean;
  smart: SmartModeConfig;
  /** Minutes of cumulative drift before Beacon nudges the user. */
  driftReminderMinutes: number;
  notificationsEnabled: boolean;
}

export type SessionStatus = 'active' | 'paused' | 'break' | 'completed' | 'cancelled';

export interface FocusSession {
  id: string;
  goal: string;
  type: SessionType;
  /** Planned duration in minutes. */
  durationMinutes: number;
  status: SessionStatus;
  startedAt: number;
  /** Epoch ms when the current phase (focus/break) is scheduled to end. */
  phaseEndsAt: number;
  endedAt?: number;
  pomodoro?: PomodoroConfig;
  /** Which pomodoro round we are on (1-indexed). */
  pomodoroRound?: number;
  /** Accumulated paused time in ms (so timers stay accurate across pauses). */
  pausedAccumMs: number;
  pausedAt?: number;
}

export type EventType =
  | 'visit' // spent time on a domain
  | 'blocked' // a navigation was blocked
  | 'warned' // a warning/intent check was shown
  | 'continued' // user chose to continue past a warning
  | 'returned' // user chose to return from a warning
  | 'tab_switch'
  | 'drift_nudge'
  | 'intent';

export interface BeaconEvent {
  id: string;
  ts: number;
  type: EventType;
  sessionId?: string;
  domain?: string;
  /** Seconds spent (for `visit` events). */
  seconds?: number;
  category?: RuleCategory;
  /** Intent chosen on an intent-check prompt. */
  intent?: 'work' | 'learning' | 'research' | 'personal';
  meta?: Record<string, string | number | boolean>;
}

/** A finished session, persisted for reports. */
export interface SessionRecord {
  id: string;
  goal: string;
  type: SessionType;
  durationMinutes: number;
  startedAt: number;
  endedAt: number;
  status: SessionStatus;
  focusSeconds: number;
  distractionSeconds: number;
  blockedCount: number;
  warnedCount: number;
}

export interface StorageShape {
  settings: Settings;
  rules: WebsiteRule[];
  currentSession: FocusSession | null;
  events: BeaconEvent[];
  history: SessionRecord[];
  /** Per-tab granted-continue domains, transient (kept in session storage). */
}

export const STORAGE_KEYS = {
  settings: 'beacon.settings',
  rules: 'beacon.rules',
  currentSession: 'beacon.currentSession',
  events: 'beacon.events',
  history: 'beacon.history',
} as const;

export const DEFAULT_SETTINGS: Settings = {
  pomodoro: { enabled: false, focusMinutes: 25, breakMinutes: 5 },
  intentCheck: true,
  smart: { youtube: true, reddit: true },
  driftReminderMinutes: 15,
  notificationsEnabled: true,
};

export const DEFAULT_RULES: WebsiteRule[] = [
  // Blocked — high-distraction by default.
  ...['instagram.com', 'tiktok.com', 'facebook.com', 'netflix.com'].map(
    seedRule('blocked')
  ),
  // Warning — useful but easy to lose time on.
  ...['youtube.com', 'reddit.com', 'twitter.com', 'x.com'].map(seedRule('warning')),
  // Allowed — known-productive.
  ...[
    'github.com',
    'stackoverflow.com',
    'flutter.dev',
    'developer.mozilla.org',
  ].map(seedRule('allowed')),
];

function seedRule(category: RuleCategory) {
  return (pattern: string, i: number): WebsiteRule => ({
    id: `seed-${category}-${i}-${pattern}`,
    pattern,
    category,
    createdAt: 0,
  });
}
