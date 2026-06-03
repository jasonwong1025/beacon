import { storage } from '../modules/storage';
import { DEFAULT_SETTINGS } from '../modules/types';
import type { Message } from '../modules/messaging';
import {
  startSession,
  pauseCurrent,
  resumeCurrent,
  endSession,
  skipBreak,
  onPhaseElapsed,
  updateBadge,
} from './sessionController';
import { setActive, recordTabSwitch, flushActive, recordEvent } from './tracker';
import { guardNavigation } from './guard';
import { transient } from './transient';
import { hostFromUrl } from '../modules/website-rules';

// ---- Lifecycle ----

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Fresh install: settings with userProfile=null triggers the onboarding wizard.
    // Rules are empty — they'll be seeded when the user picks their profile.
    await storage.setSettings(DEFAULT_SETTINGS);
    await storage.setRules([]);
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
  } else if (details.reason === 'update') {
    // Existing users upgrading: silently assign 'general' so they skip onboarding.
    const s = await storage.getSettings();
    if (!s.userProfile) {
      await storage.setSettings({ ...s, userProfile: 'general' });
    }
  }
  // Re-arm the periodic tracker alarm and badge after updates/restarts.
  const session = await storage.getSession();
  if (session && (session.status === 'active' || session.status === 'break')) {
    chrome.alarms.create('beacon-track', { periodInMinutes: 1 });
    chrome.alarms.create('beacon-phase', { when: session.phaseEndsAt });
    await updateBadge(session);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const session = await storage.getSession();
  if (session && (session.status === 'active' || session.status === 'break')) {
    chrome.alarms.create('beacon-track', { periodInMinutes: 1 });
    chrome.alarms.create('beacon-phase', { when: session.phaseEndsAt });
    await updateBadge(session);
  }
});

// ---- Messages from popup / dashboard / intervention pages ----

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, ...(data ?? {}) }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // keep the channel open for async response
});

async function handleMessage(
  message: Message
): Promise<Record<string, unknown> | void> {
  switch (message.type) {
    case 'START_SESSION':
      await startSession(message.payload);
      return;
    case 'PAUSE_SESSION':
      await pauseCurrent();
      return;
    case 'RESUME_SESSION':
      await resumeCurrent();
      return;
    case 'END_SESSION':
      await endSession(message.payload?.reason ?? 'cancelled');
      return;
    case 'SKIP_BREAK':
      await skipBreak();
      return;
    case 'CONTINUE_PAST_WARNING': {
      const { tabId, domain, url, intent } = message.payload;
      await transient.addGrant(tabId, domain);
      await recordEvent('continued', { domain });
      if (intent) {
        await recordEvent('intent', {
          domain,
          intent: intent as 'work' | 'learning' | 'research' | 'personal',
        });
      }
      try {
        await chrome.tabs.update(tabId, { url });
      } catch {
        /* tab gone */
      }
      return;
    }
    case 'RETURN_FROM_WARNING': {
      await recordEvent('returned');
      return;
    }
    case 'GET_STATE':
      return { session: await storage.getSession() };
    default:
      return;
  }
}

// ---- Navigation interception ----

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only
  await guardNavigation(details.tabId, details.url);
});

// Catch client-side SPA navigations (e.g. YouTube) too.
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return;
  await guardNavigation(details.tabId, details.url);
});

// ---- Active-tab time tracking ----

chrome.tabs.onActivated.addListener(async (info) => {
  await recordTabSwitch();
  try {
    const tab = await chrome.tabs.get(info.tabId);
    await setActive(info.tabId, tab.url);
  } catch {
    /* tab gone */
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const active = await transient.getActiveTab();
    if (active && active.tabId === tabId) {
      const newDomain = hostFromUrl(changeInfo.url);
      if (newDomain !== active.domain) {
        await setActive(tabId, changeInfo.url);
      }
    } else if (tab.active) {
      await setActive(tabId, changeInfo.url);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await transient.clearGrantsForTab(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus — bank the time and pause tracking.
    await flushActive();
    await transient.setActiveTab(null);
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab?.id != null) await setActive(tab.id, tab.url);
  } catch {
    /* ignore */
  }
});

// ---- Alarms (timer + periodic flush) ----

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'beacon-phase') {
    await onPhaseElapsed();
  } else if (alarm.name === 'beacon-track') {
    await flushActive();
    const session = await storage.getSession();
    if (session && (session.status === 'active' || session.status === 'break')) {
      await updateBadge(session);
    }
  }
});
