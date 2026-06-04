import { storage } from '../modules/storage';
import {
  createSession,
  pauseSession,
  resumeSession,
  advancePhase,
  type NewSessionInput,
} from '../modules/session-engine';
import { hostMatches } from '../modules/website-rules';
import { formatHm } from '../modules/session-engine';
import type { FocusSession, SessionRecord } from '../modules/types';
import { rulesForProfile } from '../modules/types';
import { transient } from './transient';
import { flushActive } from './tracker';
import { notify } from './notify';

const PHASE_ALARM = 'beacon-phase';
const TRACK_ALARM = 'beacon-track';

function schedulePhaseAlarm(session: FocusSession): void {
  chrome.alarms.create(PHASE_ALARM, { when: session.phaseEndsAt });
}

function ensureTrackAlarm(): void {
  chrome.alarms.create(TRACK_ALARM, { periodInMinutes: 1 });
}

export async function startSession(input: NewSessionInput): Promise<void> {
  if (input.profileId) {
    const customPresets = await storage.getCustomPresets();
    const presetRules = rulesForProfile(input.profileId, customPresets).map((r, i) => ({
      ...r,
      id: `r_${Date.now().toString(36)}_${i}`,
      createdAt: Date.now(),
    }));
    await storage.setRules(presetRules);
    const settings = await storage.getSettings();
    await storage.setSettings({ ...settings, userProfile: input.profileId });
  }

  const session = createSession(input);
  await storage.setSession(session);
  await transient.clearAllGrants();
  await transient.setLastNudge(0);
  schedulePhaseAlarm(session);
  ensureTrackAlarm();
  await updateBadge(session);
  await notify(
    'Focus session started',
    `${session.goal || 'Stay on course'} — ${formatHm(session.durationMinutes * 60000)}`,
    'beacon-start'
  );
}

export async function pauseCurrent(): Promise<void> {
  const session = await storage.getSession();
  if (!session) return;
  await flushActive();
  const next = pauseSession(session);
  await storage.setSession(next);
  chrome.alarms.clear(PHASE_ALARM);
  await updateBadge(next);
}

export async function resumeCurrent(): Promise<void> {
  const session = await storage.getSession();
  if (!session) return;
  const next = resumeSession(session);
  await storage.setSession(next);
  schedulePhaseAlarm(next);
  await updateBadge(next);
}

export async function skipBreak(): Promise<void> {
  const session = await storage.getSession();
  if (!session || session.status !== 'break') return;
  const { session: next } = advancePhase({ ...session, phaseEndsAt: Date.now() });
  await storage.setSession(next);
  if (next.status === 'completed') {
    await finalize(next);
  } else {
    schedulePhaseAlarm(next);
    await updateBadge(next);
  }
}

export async function endSession(
  reason: 'completed' | 'cancelled' = 'cancelled'
): Promise<void> {
  const session = await storage.getSession();
  if (!session) return;
  await flushActive();
  const ended: FocusSession = {
    ...session,
    status: reason === 'completed' ? 'completed' : 'cancelled',
    endedAt: Date.now(),
  };
  await finalize(ended);
}

/** Called when the phase alarm fires. */
export async function onPhaseElapsed(): Promise<void> {
  const session = await storage.getSession();
  if (!session || session.status === 'paused') return;
  if (Date.now() < session.phaseEndsAt - 1000) {
    // Spurious; reschedule.
    schedulePhaseAlarm(session);
    return;
  }
  await flushActive();
  const { session: next, transition } = advancePhase(session);
  await storage.setSession(next);

  if (transition === 'completed') {
    await finalize(next);
    return;
  }
  schedulePhaseAlarm(next);
  await updateBadge(next);
  if (transition === 'break-started') {
    await notify('Break time', `Round done. Take ${session.pomodoro?.breakMinutes ?? 5} min.`, 'beacon-phase');
  } else if (transition === 'focus-resumed') {
    await notify('Back to focus', `Round ${next.pomodoroRound}. You've got this.`, 'beacon-phase');
  }
}

/** Build and store a SessionRecord, clear current session + alarms. */
async function finalize(session: FocusSession): Promise<void> {
  const record = await buildRecord(session);
  await storage.addHistory(record);
  await storage.setSession(null);
  await transient.clearAllGrants();
  await transient.setActiveTab(null);
  chrome.alarms.clear(PHASE_ALARM);
  chrome.alarms.clear(TRACK_ALARM);
  await clearBadge();

  if (session.status === 'completed') {
    const focus = formatHm(record.focusSeconds * 1000);
    const distract = formatHm(record.distractionSeconds * 1000);
    await notify(
      'Session complete 🎉',
      `Focus: ${focus} · Distraction: ${distract}\nGoal: ${session.goal || '—'}`,
      'beacon-complete'
    );
  }
}

async function buildRecord(session: FocusSession): Promise<SessionRecord> {
  const [events, rules] = await Promise.all([
    storage.getEvents(),
    storage.getRules(),
  ]);
  const mine = events.filter((e) => e.sessionId === session.id);

  let focusSeconds = 0;
  let distractionSeconds = 0;
  let blockedCount = 0;
  let warnedCount = 0;

  for (const e of mine) {
    if (e.type === 'blocked') blockedCount += 1;
    if (e.type === 'warned') warnedCount += 1;
    if (e.type === 'visit' && e.domain && e.seconds) {
      const productive = rules.some(
        (r) => r.category === 'allowed' && hostMatches(e.domain!, r.pattern)
      );
      const distracting = rules.some(
        (r) =>
          (r.category === 'blocked' || r.category === 'warning') &&
          hostMatches(e.domain!, r.pattern)
      );
      if (productive) focusSeconds += e.seconds;
      else if (distracting) distractionSeconds += e.seconds;
      else focusSeconds += e.seconds; // neutral counts toward focus during a session
    }
  }

  return {
    id: session.id,
    goal: session.goal,
    type: session.type,
    profileId: session.profileId,
    durationMinutes: session.durationMinutes,
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? Date.now(),
    status: session.status,
    focusSeconds,
    distractionSeconds,
    blockedCount,
    warnedCount,
  };
}

// ---- Toolbar badge reflects remaining minutes / state ----

async function updateBadge(session: FocusSession): Promise<void> {
  try {
    if (session.status === 'paused') {
      await chrome.action.setBadgeText({ text: '⏸' });
      await chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
      return;
    }
    if (session.status === 'break') {
      await chrome.action.setBadgeText({ text: 'brk' });
      await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      return;
    }
    const minsLeft = Math.max(0, Math.ceil((session.phaseEndsAt - Date.now()) / 60000));
    await chrome.action.setBadgeText({ text: String(minsLeft) });
    await chrome.action.setBadgeBackgroundColor({ color: '#1d61f2' });
  } catch {
    // ignore
  }
}

async function clearBadge(): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text: '' });
  } catch {
    // ignore
  }
}

export { updateBadge };
