import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  DEFAULT_RULES,
  type Settings,
  type WebsiteRule,
  type CustomProfilePreset,
  type FocusSession,
  type BeaconEvent,
  type SessionRecord,
} from '../types';

const area = () => chrome.storage.local;

/** Cap stored raw events to keep storage bounded; aggregates live in history. */
const MAX_EVENTS = 5000;

async function get<T>(key: string, fallback: T): Promise<T> {
  const res = await area().get(key);
  return (res[key] as T | undefined) ?? fallback;
}

async function set(key: string, value: unknown): Promise<void> {
  await area().set({ [key]: value });
}

export const storage = {
  // ---- Settings ----
  async getSettings(): Promise<Settings> {
    const s = await get<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    // Merge to tolerate added fields across versions.
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      pomodoro: { ...DEFAULT_SETTINGS.pomodoro, ...s.pomodoro },
      smart: { ...DEFAULT_SETTINGS.smart, ...s.smart },
      warnFriction: { ...DEFAULT_SETTINGS.warnFriction, ...s.warnFriction },
      // Preserve null explicitly; undefined (pre-profile-feature) → null
      userProfile: s.userProfile ?? null,
    };
  },
  async setSettings(settings: Settings): Promise<void> {
    await set(STORAGE_KEYS.settings, settings);
  },

  // ---- Rules ----
  async getRules(): Promise<WebsiteRule[]> {
    return get<WebsiteRule[]>(STORAGE_KEYS.rules, DEFAULT_RULES);
  },
  async setRules(rules: WebsiteRule[]): Promise<void> {
    await set(STORAGE_KEYS.rules, rules);
  },

  // ---- Custom profile presets ----
  async getCustomPresets(): Promise<CustomProfilePreset[]> {
    return get<CustomProfilePreset[]>(STORAGE_KEYS.customPresets, []);
  },
  async setCustomPresets(presets: CustomProfilePreset[]): Promise<void> {
    await set(STORAGE_KEYS.customPresets, presets);
  },

  // ---- Current session ----
  async getSession(): Promise<FocusSession | null> {
    return get<FocusSession | null>(STORAGE_KEYS.currentSession, null);
  },
  async setSession(session: FocusSession | null): Promise<void> {
    await set(STORAGE_KEYS.currentSession, session);
  },

  // ---- Events ----
  async getEvents(): Promise<BeaconEvent[]> {
    return get<BeaconEvent[]>(STORAGE_KEYS.events, []);
  },
  async addEvent(event: BeaconEvent): Promise<void> {
    const events = await this.getEvents();
    events.push(event);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    await set(STORAGE_KEYS.events, events);
  },
  async setEvents(events: BeaconEvent[]): Promise<void> {
    await set(STORAGE_KEYS.events, events);
  },

  // ---- History (completed sessions) ----
  async getHistory(): Promise<SessionRecord[]> {
    return get<SessionRecord[]>(STORAGE_KEYS.history, []);
  },
  async addHistory(record: SessionRecord): Promise<void> {
    const history = await this.getHistory();
    history.push(record);
    await set(STORAGE_KEYS.history, history);
  },
  async setHistory(history: SessionRecord[]): Promise<void> {
    await set(STORAGE_KEYS.history, history);
  },

  /** Wipe everything Beacon stores (used by "Clear all data"). */
  async clearAll(): Promise<void> {
    await area().remove(Object.values(STORAGE_KEYS));
  },
};

type ChangeListener = (changes: { [key: string]: chrome.storage.StorageChange }) => void;

/** Subscribe to changes for the given storage keys. Returns an unsubscribe fn. */
export function onStorageChanged(keys: string[], cb: ChangeListener): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName !== 'local') return;
    const relevant = Object.keys(changes).some((k) => keys.includes(k));
    if (relevant) cb(changes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export { STORAGE_KEYS };
