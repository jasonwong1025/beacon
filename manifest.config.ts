import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Beacon — Stay on course',
  description:
    'Intentional browsing. Stay aligned with your goals with focus sessions, gentle interventions, and local-first analytics.',
  version: pkg.version,
  icons: {
    16: 'public/icons/icon16.png',
    32: 'public/icons/icon32.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'public/icons/icon16.png',
      32: 'public/icons/icon32.png',
      48: 'public/icons/icon48.png',
      128: 'public/icons/icon128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  options_page: 'src/dashboard/index.html',
  permissions: [
    'storage',
    'tabs',
    'webNavigation',
    'alarms',
    'notifications',
    'favicon',
    'declarativeNetRequest',
  ],
  host_permissions: ['<all_urls>'],
  web_accessible_resources: [
    {
      resources: ['src/pages/blocked.html', 'src/pages/warn.html'],
      matches: ['<all_urls>'],
    },
  ],
});
