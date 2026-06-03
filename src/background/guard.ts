import { storage } from '../modules/storage';
import { classify, hostFromUrl, isWebUrl } from '../modules/website-rules';
import { transient } from './transient';
import { recordEvent } from './tracker';
import { blockedPageUrl, warnPageUrl } from './pages';

/**
 * Intercept a main-frame navigation. Returns true if it redirected the tab
 * (i.e. the navigation was blocked or warned).
 */
export async function guardNavigation(
  tabId: number,
  url: string
): Promise<boolean> {
  if (!isWebUrl(url)) return false;

  const session = await storage.getSession();
  if (!session || (session.status !== 'active' && session.status !== 'break')) {
    return false; // Rules only apply during an active session.
  }

  const [rules, settings] = await Promise.all([
    storage.getRules(),
    storage.getSettings(),
  ]);

  const verdict = classify(url, rules, settings.smart);
  if (verdict.decision === 'allow') return false;

  const domain = hostFromUrl(url) ?? verdict.matchedHost ?? url;

  if (verdict.decision === 'block') {
    await recordEvent('blocked', { domain, category: 'blocked' });
    const dest = blockedPageUrl({
      target: url,
      host: domain,
      reason: verdict.reason ?? 'On your block list',
      goal: session.goal,
    });
    await safeNavigate(tabId, dest);
    return true;
  }

  // warn
  if (await transient.hasGrant(tabId, domain)) {
    return false; // already approved for this tab+domain this session
  }
  await recordEvent('warned', { domain, category: 'warning' });
  const dest = warnPageUrl({
    target: url,
    host: domain,
    reason: verdict.reason ?? 'On your warning list',
    goal: session.goal,
    intent: settings.intentCheck,
  });
  await safeNavigate(tabId, dest);
  return true;
}

async function safeNavigate(tabId: number, url: string): Promise<void> {
  try {
    await chrome.tabs.update(tabId, { url });
  } catch {
    // Tab may have closed; ignore.
  }
}
