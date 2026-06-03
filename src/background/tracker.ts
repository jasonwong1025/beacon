import { storage } from '../modules/storage';
import { transient } from './transient';
import { hostFromUrl, isWebUrl } from '../modules/website-rules';
import {
  detectTabThrash,
  detectRepeatDistraction,
} from '../modules/analytics';
import type { BeaconEvent, EventType } from '../modules/types';
import { notify } from './notify';

const NUDGE_COOLDOWN_MS = 5 * 60_000;
const MIN_VISIT_SECONDS = 2; // ignore sub-2s blips

function makeEvent(type: EventType, extra: Partial<BeaconEvent> = {}): BeaconEvent {
  return {
    id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    type,
    ...extra,
  };
}

async function sessionIsRunning(): Promise<boolean> {
  const s = await storage.getSession();
  return !!s && (s.status === 'active' || s.status === 'break');
}

/** Flush accumulated time for the currently active tab into a `visit` event. */
export async function flushActive(): Promise<void> {
  const active = await transient.getActiveTab();
  if (!active) return;
  const now = Date.now();
  const seconds = Math.round((now - active.since) / 1000);
  if (seconds >= MIN_VISIT_SECONDS && (await sessionIsRunning())) {
    const session = await storage.getSession();
    await storage.addEvent(
      makeEvent('visit', {
        domain: active.domain,
        seconds,
        sessionId: session?.id,
      })
    );
  }
  // Reset the clock on the same domain.
  await transient.setActiveTab({ ...active, since: now });
}

/** Set which tab/domain is currently in focus, flushing the previous one first. */
export async function setActive(tabId: number, url: string | undefined): Promise<void> {
  await flushActive();
  if (!url || !isWebUrl(url)) {
    await transient.setActiveTab(null);
    return;
  }
  const domain = hostFromUrl(url);
  if (!domain) {
    await transient.setActiveTab(null);
    return;
  }
  await transient.setActiveTab({ tabId, domain, since: Date.now() });
}

export async function recordTabSwitch(): Promise<void> {
  if (!(await sessionIsRunning())) return;
  const session = await storage.getSession();
  await storage.addEvent(makeEvent('tab_switch', { sessionId: session?.id }));
  await maybeNudge();
}

export async function recordEvent(
  type: EventType,
  extra: Partial<BeaconEvent> = {}
): Promise<void> {
  const session = await storage.getSession();
  await storage.addEvent(makeEvent(type, { sessionId: session?.id, ...extra }));
}

/** Check live distraction signals and gently nudge (throttled). */
export async function maybeNudge(): Promise<void> {
  if (!(await sessionIsRunning())) return;
  const last = await transient.getLastNudge();
  const now = Date.now();
  if (now - last < NUDGE_COOLDOWN_MS) return;

  const events = await storage.getEvents();
  const signal = detectTabThrash(events) ?? detectRepeatDistraction(events);
  if (!signal) return;

  const session = await storage.getSession();
  await transient.setLastNudge(now);
  await recordEvent('drift_nudge', { meta: { kind: signal.type } });
  await notify(
    'Drifting from your goal?',
    `${signal.message}\nReturn to: ${session?.goal ?? 'your focus'}`,
    'beacon-drift'
  );
}
