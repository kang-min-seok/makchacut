'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { HOME_PATH } from '@/lib/routes';

type TopBarProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

// 뒤로 가기: 앱 안에서 왔으면 이전 화면, 주소로 바로 들어왔으면 홈
export function TopBar({ title, subtitle, action }: TopBarProps) {
  const router = useRouter();
  const goBack = () => (window.history.length > 1 ? router.back() : router.push(HOME_PATH));

  return (
    <header className="flex items-center gap-1 px-2 py-1.5">
      <Button variant="ghost" size="icon-xl" aria-label="뒤로" onClick={goBack}>
        <ChevronLeft />
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-bold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
