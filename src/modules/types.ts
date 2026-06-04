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
  /** null = fresh install, onboarding not yet completed. */
  userProfile: ProfileId | null;
}

export type SessionStatus = 'active' | 'paused' | 'break' | 'completed' | 'cancelled';

export interface FocusSession {
  id: string;
  goal: string;
  type: SessionType;
  /** When set, display and rules come from this profile preset. */
  profileId?: ProfileId;
  /** Snapshot of preset display at session start. */
  profileLabel?: string;
  profileEmoji?: string;
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
  profileId?: ProfileId;
  profileLabel?: string;
  profileEmoji?: string;
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
  customPresets: CustomProfilePreset[];
  currentSession: FocusSession | null;
  events: BeaconEvent[];
  history: SessionRecord[];
  /** Per-tab granted-continue domains, transient (kept in session storage). */
}

export type BuiltinProfile =
  | 'general'
  | 'student'
  | 'developer'
  | 'professional'
  | 'researcher'
  | 'creator';

/** Built-in preset id, or `custom_*` for user-created presets. */
export type ProfileId = BuiltinProfile | string;

/** @deprecated Use BuiltinProfile or ProfileId */
export type UserProfile = BuiltinProfile;

export interface ProfilePreset {
  id: BuiltinProfile;
  label: string;
  emoji: string;
  tagline: string;
  desc: string;
  blocked: string[];
  warning: string[];
  allowed: string[];
}

/** User-created profile preset, stored in chrome.storage.local. */
export interface CustomProfilePreset {
  id: string;
  label: string;
  emoji: string;
  tagline: string;
  desc: string;
  blocked: string[];
  warning: string[];
  allowed: string[];
  createdAt: number;
}

export type AnyProfilePreset = ProfilePreset | CustomProfilePreset;

export function isCustomProfileId(id: ProfileId): boolean {
  return id.startsWith('custom_');
}

export function newCustomPresetId(): string {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyCustomPreset(): CustomProfilePreset {
  return {
    id: newCustomPresetId(),
    label: 'My Preset',
    emoji: '✨',
    tagline: '',
    desc: '',
    blocked: [],
    warning: [],
    allowed: [],
    createdAt: Date.now(),
  };
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    id: 'general',
    label: 'General',
    emoji: '🌐',
    tagline: 'Everyday browsing, less distraction',
    desc: 'A balanced starting point for anyone who wants to spend less time on social media and more time on what matters.',
    blocked: ['tiktok.com', 'facebook.com', 'snapchat.com', '9gag.com', 'buzzfeed.com'],
    warning: [
      'instagram.com', 'youtube.com', 'reddit.com', 'twitter.com', 'x.com',
      'netflix.com', 'twitch.tv', 'pinterest.com',
    ],
    allowed: ['wikipedia.org', 'google.com', 'maps.google.com', 'notion.so'],
  },
  {
    id: 'student',
    label: 'Student',
    emoji: '📚',
    tagline: 'Study sessions without the rabbit holes',
    desc: 'Built for exam prep, research, and deep learning. Keeps learning platforms open and blocks the biggest time-sinks.',
    blocked: [
      'tiktok.com', 'facebook.com', 'snapchat.com', 'instagram.com',
      'netflix.com', 'twitch.tv', '9gag.com',
    ],
    warning: ['youtube.com', 'reddit.com', 'twitter.com', 'x.com', 'pinterest.com', 'amazon.com'],
    allowed: [
      'khanacademy.org', 'coursera.org', 'udemy.com', 'edx.org',
      'wikipedia.org', 'scholar.google.com', 'wolframalpha.com',
      'duolingo.com', 'notion.so', 'google.com',
    ],
  },
  {
    id: 'developer',
    label: 'Developer',
    emoji: '💻',
    tagline: 'Deep work for programmers',
    desc: 'Keeps docs, repos, and references always open. Warns on feeds and trending — keeps tutorials accessible.',
    blocked: [
      'tiktok.com', 'facebook.com', 'snapchat.com', 'instagram.com', '9gag.com',
    ],
    warning: [
      'youtube.com', 'reddit.com', 'twitter.com', 'x.com',
      'twitch.tv', 'news.ycombinator.com',
    ],
    allowed: [
      'github.com', 'stackoverflow.com', 'developer.mozilla.org',
      'npmjs.com', 'devdocs.io', 'codepen.io', 'caniuse.com',
      'docs.python.org', 'figma.com', 'google.com',
    ],
  },
  {
    id: 'professional',
    label: 'Professional',
    emoji: '💼',
    tagline: 'Remote work without the noise',
    desc: 'Designed for reports, project work, and admin tasks. Keeps your productivity tools always open.',
    blocked: [
      'tiktok.com', 'facebook.com', 'snapchat.com', 'instagram.com',
      'netflix.com', 'twitch.tv', '9gag.com',
    ],
    warning: [
      'youtube.com', 'reddit.com', 'twitter.com', 'x.com',
      'pinterest.com', 'amazon.com',
    ],
    allowed: [
      'linkedin.com', 'notion.so', 'docs.google.com', 'drive.google.com',
      'zoom.us', 'slack.com', 'trello.com', 'asana.com', 'google.com',
    ],
  },
  {
    id: 'researcher',
    label: 'Researcher',
    emoji: '🔬',
    tagline: 'Literature reviews without drift',
    desc: 'Optimised for academic reading and data collection. Keeps scholarly sources open and social media out.',
    blocked: [
      'tiktok.com', 'facebook.com', 'snapchat.com', 'instagram.com',
      'netflix.com', 'twitch.tv', '9gag.com',
    ],
    warning: ['youtube.com', 'reddit.com', 'twitter.com', 'x.com'],
    allowed: [
      'scholar.google.com', 'wikipedia.org', 'pubmed.ncbi.nlm.nih.gov',
      'jstor.org', 'arxiv.org', 'researchgate.net', 'semanticscholar.org',
      'google.com', 'notion.so', 'zotero.org',
    ],
  },
  {
    id: 'creator',
    label: 'Creator',
    emoji: '🎨',
    tagline: 'Make more, scroll less',
    desc: 'For designers, writers, and content creators. Keeps creative tools and references open, tames the feeds.',
    blocked: ['tiktok.com', 'facebook.com', 'snapchat.com', 'netflix.com', '9gag.com'],
    warning: [
      'instagram.com', 'youtube.com', 'reddit.com', 'twitter.com',
      'x.com', 'pinterest.com',
    ],
    allowed: [
      'figma.com', 'dribbble.com', 'behance.net', 'canva.com',
      'unsplash.com', 'fonts.google.com', 'coolors.co',
      'adobe.com', 'notion.so', 'google.com',
    ],
  },
];

type PresetSiteLists = Pick<ProfilePreset, 'blocked' | 'warning' | 'allowed'>;

export function rulesFromSiteLists(lists: PresetSiteLists): WebsiteRule[] {
  return [
    ...lists.blocked.map(seedRule('blocked')),
    ...lists.warning.map(seedRule('warning')),
    ...lists.allowed.map(seedRule('allowed')),
  ];
}

export function rulesForProfile(
  profile: ProfileId,
  customPresets: CustomProfilePreset[] = []
): WebsiteRule[] {
  const preset = resolvePreset(profile, customPresets);
  if (!preset) return [];
  return rulesFromSiteLists(preset);
}

export function resolvePreset(
  profile: ProfileId,
  customPresets: CustomProfilePreset[] = []
): AnyProfilePreset | null {
  const builtin = PROFILE_PRESETS.find((p) => p.id === profile);
  if (builtin) return builtin;
  return customPresets.find((p) => p.id === profile) ?? null;
}

/** Options for the popup session-type picker (built-ins + custom profile presets). */
export interface SessionTypeOption {
  id: string;
  label: string;
  emoji: string;
  profileId?: ProfileId;
}

export function buildSessionTypeOptions(
  customPresets: CustomProfilePreset[]
): SessionTypeOption[] {
  const builtins: SessionTypeOption[] = PROFILE_PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    emoji: p.emoji,
    profileId: p.id,
  }));
  const customs: SessionTypeOption[] = customPresets.map((p) => ({
    id: p.id,
    label: p.label,
    emoji: p.emoji,
    profileId: p.id,
  }));
  return [...builtins, ...customs];
}

export function sessionTypeDisplay(
  session: {
    type: SessionType;
    profileId?: ProfileId;
    profileLabel?: string;
    profileEmoji?: string;
  },
  customPresets: CustomProfilePreset[] = [],
  activeProfileId?: ProfileId | null
): { emoji: string; label: string } {
  if (session.profileEmoji && session.profileLabel) {
    return { emoji: session.profileEmoji, label: session.profileLabel };
  }
  const profileId = session.profileId ?? activeProfileId ?? undefined;
  if (profileId) {
    const preset = resolvePreset(profileId, customPresets);
    if (preset) return { emoji: preset.emoji, label: preset.label };
  }
  const builtin = SESSION_TYPES.find((t) => t.value === session.type);
  return { emoji: builtin?.emoji ?? '✨', label: builtin?.label ?? 'Custom' };
}

export const STORAGE_KEYS = {
  settings: 'beacon.settings',
  rules: 'beacon.rules',
  customPresets: 'beacon.customPresets',
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
  userProfile: null,
};

/** Fallback used by "Reset to defaults" when no profile is stored. */
export const DEFAULT_RULES: WebsiteRule[] = rulesForProfile('general');

function seedRule(category: RuleCategory) {
  return (pattern: string, i: number): WebsiteRule => ({
    id: `seed-${category}-${i}-${pattern}`,
    pattern,
    category,
    createdAt: 0,
  });
}
