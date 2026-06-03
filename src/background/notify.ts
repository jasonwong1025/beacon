import { storage } from '../modules/storage';

const ICON = chrome.runtime.getURL('public/icons/icon128.png');

export async function notify(title: string, message: string, id?: string): Promise<void> {
  const settings = await storage.getSettings();
  if (!settings.notificationsEnabled) return;
  try {
    chrome.notifications.create(id ?? `beacon-${Date.now()}`, {
      type: 'basic',
      iconUrl: ICON,
      title,
      message,
      priority: 1,
    });
  } catch {
    // Notifications can fail if the permission/icon is unavailable; ignore.
  }
}
