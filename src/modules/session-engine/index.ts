import type {
  FocusSession,
  SessionType,
  ProfileId,
  PomodoroConfig,
} from '../types';

export interface NewSessionInput {
  goal: string;
  type: SessionType;
  durationMinutes: number;
  profileId?: ProfileId;
  pomodoro?: PomodoroConfig;
}

const uid = () =>
  `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function createSession(input: NewSessionInput): FocusSession {
  const now = Date.now();
  const usingPomodoro = !!input.pomodoro?.enabled;
  const firstPhaseMinutes = usingPomodoro
    ? input.pomodoro!.focusMinutes
    : input.durationMinutes;

  return {
    id: uid(),
    goal: input.goal.trim(),
    type: input.type,
    profileId: input.profileId,
    durationMinutes: input.durationMinutes,
    status: 'active',
    startedAt: now,
    phaseEndsAt: now + firstPhaseMinutes * 60_000,
    pomodoro: input.pomodoro,
    pomodoroRound: usingPomodoro ? 1 : undefined,
    pausedAccumMs: 0,
  };
}

/** Milliseconds remaining in the current phase (focus or break). */
export function remainingMs(session: FocusSession, now = Date.now()): number {
  if (session.status === 'paused' && session.pausedAt) {
    return Math.max(0, session.phaseEndsAt - session.pausedAt);
  }
  return Math.max(0, session.phaseEndsAt - now);
}

/** Total elapsed focus time since the session started (excludes paused time). */
export function elapsedMs(session: FocusSession, now = Date.now()): number {
  const pausedExtra =
    session.status === 'paused' && session.pausedAt ? now - session.pausedAt : 0;
  return Math.max(0, now - session.startedAt - session.pausedAccumMs - pausedExtra);
}

export function pauseSession(session: FocusSession, now = Date.now()): FocusSession {
  if (session.status !== 'active' && session.status !== 'break') return session;
  return { ...session, status: 'paused', pausedAt: now };
}

export function resumeSession(session: FocusSession, now = Date.now()): FocusSession {
  if (session.status !== 'paused' || !session.pausedAt) return session;
  const pausedFor = now - session.pausedAt;
  return {
    ...session,
    status: 'active',
    phaseEndsAt: session.phaseEndsAt + pausedFor,
    pausedAccumMs: session.pausedAccumMs + pausedFor,
    pausedAt: undefined,
  };
}

/**
 * Advance a session whose current phase just ended.
 * Returns the next session state plus what kind of transition happened.
 */
export function advancePhase(
  session: FocusSession,
  now = Date.now()
): { session: FocusSession; transition: 'break-started' | 'focus-resumed' | 'completed' } {
  const pomo = session.pomodoro;

  // Non-pomodoro session simply completes when the timer ends.
  if (!pomo?.enabled) {
    return {
      session: { ...session, status: 'completed', endedAt: now },
      transition: 'completed',
    };
  }

  // Pomodoro: alternate focus <-> break until the planned duration is consumed.
  const elapsedMin = elapsedMs(session, now) / 60_000;
  if (elapsedMin >= session.durationMinutes) {
    return {
      session: { ...session, status: 'completed', endedAt: now },
      transition: 'completed',
    };
  }

  if (session.status === 'break') {
    // Break ended -> back to focus.
    return {
      session: {
        ...session,
        status: 'active',
        phaseEndsAt: now + pomo.focusMinutes * 60_000,
        pomodoroRound: (session.pomodoroRound ?? 1) + 1,
      },
      transition: 'focus-resumed',
    };
  }

  // Focus ended -> break.
  return {
    session: {
      ...session,
      status: 'break',
      phaseEndsAt: now + pomo.breakMinutes * 60_000,
    },
    transition: 'break-started',
  };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function formatHm(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export const TIMER_PRESETS = [25, 50, 60, 90, 120];
