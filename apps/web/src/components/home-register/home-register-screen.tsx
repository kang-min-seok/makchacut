'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { HomeConfirm } from '@/components/home-register/home-confirm';
import { TopBar } from '@/components/layout/top-bar';
import { PlaceSearch } from '@/components/place-search/place-search';
import { homePlace } from '@/lib/home-place';
import type { Place } from '@/lib/place';
import { NEXT_PARAM, safeNextPath } from '@/lib/routes';

// 집 검색 → 확인 → 저장 뒤 원래 가려던 화면으로
export function HomeRegisterScreen() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get(NEXT_PARAM));
  const [selected, setSelected] = useState<Place | null>(null);

  const save = () => {
    if (!selected) return;
    homePlace.write(selected);
    router.replace(next);
  };

  return (
    <>
      <TopBar title={selected ? '위치 확인' : '집 등록'} />
      <main className="flex flex-col gap-5 px-5 pt-3 pb-10">
        {selected ? (
          <HomeConfirm place={selected} onSave={save} onSearchAgain={() => setSelected(null)} />
        ) : (
          <>
            <h2 className="text-2xl font-bold">집 주소를 검색하세요</h2>
            <PlaceSearch
              label="집 주소 검색"
              placeholder="도로명·건물·아파트 이름"
              autoFocus
              onSelect={setSelected}
            />
          </>
        )}
      </main>
    </>
  );
}
