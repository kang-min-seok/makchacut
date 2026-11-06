import { SettingsLink } from '@/components/layout/settings-link';

export function AppHeader() {
  return (
    <header className="flex items-center justify-between py-2.5 pr-3 pl-5">
      <span className="text-lg font-black text-primary">막차컷</span>
      <SettingsLink />
    </header>
  );
}
