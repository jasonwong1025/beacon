import { storage } from '../modules/storage';
import { classify, hostFromUrl, isWebUrl } from '../modules/website-rules';
import { transient } from './transient';
import { recordEvent } from './tracker';
import { blockedPageUrl, warnPageUrl } from './pages';

/**
 * Intercept a main-frame navigation. Returns true if this function redirected
 * the tab (i.e. did a JS-level redirect for a warning or an SPA block).
 *
 * @param skipBlockedRedirect  Pass `true` for `onBeforeNavigate` (HTTP
 *   navigations) where `declarativeNetRequest` will already handle the
 *   network-layer redirect to blocked.html — we only need to record the event.
 *   Pass `false` for `onHistoryStateUpdated` (client-side SPA route changes)
 *   where DNR never fires and guard must do the redirect itself.
 */
export async function guardNavigation(
  tabId: number,
  url: string,
  skipBlockedRedirect = false
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
    // Always record the analytics event.
    await recordEvent('blocked', { domain, category: 'blocked' });

    if (skipBlockedRedirect) {
      // For HTTP navigations: DNR already issued the network-layer redirect to
      // blocked.html — no JS redirect needed. Return false so callers know the
      // tab URL hasn't been changed by this function.
      return false;
    }

    // SPA fallback: pushState navigations bypass DNR, so redirect manually.
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
