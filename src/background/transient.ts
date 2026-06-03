// Transient state lives in chrome.storage.session so it survives service-worker
// suspension but is cleared when the browser restarts.

const session = () => chrome.storage.session;

interface ActiveTab {
  tabId: number;
  domain: string;
  since: number;
}

const KEYS = {
  activeTab: 'beacon.active',
  grants: 'beacon.grants', // tab+domain continue grants
  lastNudge: 'beacon.lastNudge',
} as const;

export const transient = {
  async getActiveTab(): Promise<ActiveTab | null> {
    const r = await session().get(KEYS.activeTab);
    return (r[KEYS.activeTab] as ActiveTab | undefined) ?? null;
  },
  async setActiveTab(active: ActiveTab | null): Promise<void> {
    await session().set({ [KEYS.activeTab]: active });
  },

  async getGrants(): Promise<string[]> {
    const r = await session().get(KEYS.grants);
    return (r[KEYS.grants] as string[] | undefined) ?? [];
  },
  async addGrant(tabId: number, domain: string): Promise<void> {
    const grants = await this.getGrants();
    const key = grantKey(tabId, domain);
    if (!grants.includes(key)) grants.push(key);
    await session().set({ [KEYS.grants]: grants });
  },
  async hasGrant(tabId: number, domain: string): Promise<boolean> {
    const grants = await this.getGrants();
    return grants.includes(grantKey(tabId, domain));
  },
  async clearGrantsForTab(tabId: number): Promise<void> {
    const grants = await this.getGrants();
    const filtered = grants.filter((g) => !g.startsWith(`${tabId}:`));
    await session().set({ [KEYS.grants]: filtered });
  },
  async clearAllGrants(): Promise<void> {
    await session().set({ [KEYS.grants]: [] });
  },

  async getLastNudge(): Promise<number> {
    const r = await session().get(KEYS.lastNudge);
    return (r[KEYS.lastNudge] as number | undefined) ?? 0;
  },
  async setLastNudge(ts: number): Promise<void> {
    await session().set({ [KEYS.lastNudge]: ts });
  },
};

function grantKey(tabId: number, domain: string): string {
  return `${tabId}:${domain}`;
}
