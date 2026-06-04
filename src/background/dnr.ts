import type { WebsiteRule } from '../modules/types';

/**
 * Derive a stable numeric DNR rule ID from a domain string using djb2 hash.
 * Range 10001–30000 — well above any potential static rule IDs (which start at 1).
 */
function domainToId(domain: string): number {
  let h = 5381;
  for (let i = 0; i < domain.length; i++) {
    h = ((h << 5) + h + domain.charCodeAt(i)) >>> 0; // djb2
  }
  return (h % 20000) + 10001;
}

/**
 * Install / refresh DNR dynamic rules to reflect the current blocked-site list.
 *
 * When a session is active, each blocked domain gets a REDIRECT rule that
 * sends the browser to blocked.html before the page even begins to render —
 * zero JS overhead, fully MV3-compliant.
 *
 * When no session is active all dynamic rules are removed.
 *
 * DNR only fires on real HTTP navigations (main_frame resource type). Client-
 * side SPA navigations (history.pushState) bypass DNR; guard.ts handles those
 * as a fallback via webNavigation.onHistoryStateUpdated.
 */
export async function syncBlockedRules(
  rules: WebsiteRule[],
  sessionActive: boolean
): Promise<void> {
  // Always start from a clean slate so the live rule set exactly matches storage.
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  if (!sessionActive) {
    if (removeRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
    return;
  }

  const blockedPage = chrome.runtime.getURL('src/pages/blocked.html');

  const addRules: chrome.declarativeNetRequest.Rule[] = rules
    .filter((r) => r.category === 'blocked')
    .map((r) => ({
      id: domainToId(r.pattern),
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          // The blocked page reads the session goal from storage — no need to
          // encode it in the URL. Only the host is needed for the message.
          url: `${blockedPage}?host=${encodeURIComponent(r.pattern)}`,
        },
      },
      condition: {
        // ||domain anchors at the domain boundary, matching the bare domain
        // AND all subdomains (www.instagram.com, m.instagram.com, etc.).
        urlFilter: `||${r.pattern}`,
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    }));

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

/** Remove all Beacon DNR dynamic rules. Called when a session ends. */
export async function clearBlockedRules(): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  if (existing.length === 0) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
  });
}
