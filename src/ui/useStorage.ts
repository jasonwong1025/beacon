import { useEffect, useState, useCallback } from 'react';
import { storage, onStorageChanged, STORAGE_KEYS } from '../modules/storage';
import type {
  Settings,
  WebsiteRule,
  CustomProfilePreset,
  FocusSession,
  BeaconEvent,
  SessionRecord,
} from '../modules/types';

export function useSession(): FocusSession | null {
  const [session, setSession] = useState<FocusSession | null>(null);
  useEffect(() => {
    storage.getSession().then(setSession);
    return onStorageChanged([STORAGE_KEYS.currentSession], () => {
      storage.getSession().then(setSession);
    });
  }, []);
  return session;
}

export function useSettings(): [Settings | null, (s: Settings) => Promise<void>] {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    storage.getSettings().then(setSettings);
    return onStorageChanged([STORAGE_KEYS.settings], () => {
      storage.getSettings().then(setSettings);
    });
  }, []);
  const update = useCallback(async (s: Settings) => {
    await storage.setSettings(s);
    setSettings(s);
  }, []);
  return [settings, update];
}

export function useRules(): [WebsiteRule[], (r: WebsiteRule[]) => Promise<void>] {
  const [rules, setRules] = useState<WebsiteRule[]>([]);
  useEffect(() => {
    storage.getRules().then(setRules);
    return onStorageChanged([STORAGE_KEYS.rules], () => {
      storage.getRules().then(setRules);
    });
  }, []);
  const update = useCallback(async (r: WebsiteRule[]) => {
    await storage.setRules(r);
    setRules(r);
  }, []);
  return [rules, update];
}

export function useCustomPresets(): [
  CustomProfilePreset[],
  (presets: CustomProfilePreset[]) => Promise<void>,
] {
  const [presets, setPresets] = useState<CustomProfilePreset[]>([]);
  useEffect(() => {
    storage.getCustomPresets().then(setPresets);
    return onStorageChanged([STORAGE_KEYS.customPresets], () => {
      storage.getCustomPresets().then(setPresets);
    });
  }, []);
  const update = useCallback(async (p: CustomProfilePreset[]) => {
    await storage.setCustomPresets(p);
    setPresets(p);
  }, []);
  return [presets, update];
}

export function useEvents(): BeaconEvent[] {
  const [events, setEvents] = useState<BeaconEvent[]>([]);
  useEffect(() => {
    storage.getEvents().then(setEvents);
    return onStorageChanged([STORAGE_KEYS.events], () => {
      storage.getEvents().then(setEvents);
    });
  }, []);
  return events;
}

export function useHistory(): SessionRecord[] {
  const [history, setHistory] = useState<SessionRecord[]>([]);
  useEffect(() => {
    storage.getHistory().then(setHistory);
    return onStorageChanged([STORAGE_KEYS.history], () => {
      storage.getHistory().then(setHistory);
    });
  }, []);
  return history;
}

/** A 1s ticking clock for live countdowns. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
