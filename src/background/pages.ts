export function blockedPageUrl(params: {
  target: string;
  host: string;
  reason: string;
  goal: string;
}): string {
  const base = chrome.runtime.getURL('src/pages/blocked.html');
  const q = new URLSearchParams({
    target: params.target,
    host: params.host,
    reason: params.reason,
    goal: params.goal,
  });
  return `${base}?${q.toString()}`;
}

export function warnPageUrl(params: {
  target: string;
  host: string;
  reason: string;
  goal: string;
  intent: boolean;
}): string {
  const base = chrome.runtime.getURL('src/pages/warn.html');
  const q = new URLSearchParams({
    target: params.target,
    host: params.host,
    reason: params.reason,
    goal: params.goal,
    intent: params.intent ? '1' : '0',
  });
  return `${base}?${q.toString()}`;
}
