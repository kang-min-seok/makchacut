'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HomeSummary } from '@/components/home/home-summary';
import { WeekCalendar } from '@/components/home/week-calendar';
import { AppHeader } from '@/components/layout/app-header';
import { PlaceSearch } from '@/components/place-search/place-search';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceToday } from '@/hooks/use-service-today';
import { NOT_LOADED, useStoredValue } from '@/hooks/use-stored-value';
import { homePlace } from '@/lib/home-place';
import type { Place } from '@/lib/place';
import { planHref } from '@/lib/plan-target';
import { homeRegisterHref } from '@/lib/routes';

export function HomeScreen() {
  const router = useRouter();
  const stored = useStoredValue(homePlace);
  const home = stored === NOT_LOADED ? undefined : stored;
  const today = useServiceToday();
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;

  // 집이 없으면 집 등록을 거쳐 결과로 간다
  const selectMeetup = (place: Place) => {
    if (!date) return;
    const href = planHref({ name: place.name, lat: place.lat, lng: place.lng, date });
    router.push(home ? href : homeRegisterHref(href));
  };

  return (
    <>
      <AppHeader />
      <main className="flex flex-col gap-6 px-5 pt-2 pb-10">
        <HomeSummary home={home} />
        <h1 className="text-[28px] leading-tight font-bold">어디서 만나요?</h1>
        <PlaceSearch
          label="약속 장소 검색"
          placeholder="약속 장소 검색 (예: 강남역)"
          onSelect={selectMeetup}
        />
        {today && date ? (
          <WeekCalendar today={today} value={date} onChange={setPicked} />
        ) : (
          <Skeleton className="h-28 w-full rounded-xl" />
        )}
      </main>
    </>
  );
}
