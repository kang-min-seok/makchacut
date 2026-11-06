import { SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { SETTINGS_PATH } from '@/lib/routes';

export function SettingsLink() {
  return (
    <Link
      href={SETTINGS_PATH}
      aria-label="설정"
      className={buttonVariants({ variant: 'ghost', size: 'icon-xl' })}
    >
      <SlidersHorizontal className="text-muted-foreground" />
    </Link>
  );
}
