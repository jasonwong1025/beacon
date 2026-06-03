import type { NewSessionInput } from './session-engine';

export type Message =
  | { type: 'START_SESSION'; payload: NewSessionInput }
  | { type: 'PAUSE_SESSION' }
  | { type: 'RESUME_SESSION' }
  | { type: 'END_SESSION'; payload?: { reason?: 'completed' | 'cancelled' } }
  | { type: 'SKIP_BREAK' }
  | { type: 'GET_STATE' }
  // From a warn/intent page when the user decides to continue past a warning.
  | {
      type: 'CONTINUE_PAST_WARNING';
      payload: { url: string; tabId: number; domain: string; intent?: string };
    }
  | { type: 'RETURN_FROM_WARNING'; payload: { tabId: number } };

export interface StateResponse {
  ok: boolean;
  error?: string;
}

export function sendMessage<T = StateResponse>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
