'use client';

import { DETOUR_LEVELS, WALK_SPEEDS } from '@makchacut/shared';
import { House } from 'lucide-react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/top-bar';
import { SettingGroupTitle, SettingItem } from '@/components/settings/setting-item';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { NOT_LOADED, useStoredValue } from '@/hooks/use-stored-value';
import { homePlace } from '@/lib/home-place';
import { homeRegisterHref, SETTINGS_PATH } from '@/lib/routes';
import {
  DEFAULT_USER_SETTINGS,
  DETOUR_LABELS,
  SAFETY_MARGIN_CHOICES,
  type UserSettings,
  userSettings,
  WALK_SPEED_LABELS,
} from '@/lib/user-settings';

const DETOUR_OPTIONS = DETOUR_LEVELS.map((value) => ({ value, label: DETOUR_LABELS[value] }));
const WALK_SPEED_OPTIONS = WALK_SPEEDS.map((value) => ({ value, label: WALK_SPEED_LABELS[value] }));
const MARGIN_OPTIONS = SAFETY_MARGIN_CHOICES.map((value) => ({
  value,
  label: value === 0 ? '없음' : `${value}분`,
}));

// 바꾸면 바로 이 기기에 저장한다
export function SettingsScreen() {
  const home = useStoredValue(homePlace);
  const stored = useStoredValue(userSettings);
  const settings = stored === NOT_LOADED || stored === null ? DEFAULT_USER_SETTINGS : stored;
  const update = (patch: Partial<UserSettings>) => userSettings.write({ ...settings, ...patch });

  return (
    <>
      <TopBar title="설정" />
      <main className="flex flex-col pb-10">
        <SettingGroupTitle>집</SettingGroupTitle>
        <div className="flex items-center gap-3 border-b border-border px-5 pt-3 pb-3.5">
          <House aria-hidden className="size-5 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-base font-medium">
            {home === NOT_LOADED ? '' : (home?.name ?? '아직 등록하지 않았어요')}
          </span>
          <Link href={homeRegisterHref(SETTINGS_PATH)} className="text-sm font-medium text-primary">
            {home && home !== NOT_LOADED ? '변경' : '등록'}
          </Link>
        </div>

        <SettingGroupTitle>경로 계산</SettingGroupTitle>
        <SettingItem
          title="돌아가는 길"
          description="막차를 더 늦게 탈 수 있다면 얼마나 돌아가도 될까요?"
        >
          <SegmentedControl
            label="돌아가는 길"
            options={DETOUR_OPTIONS}
            value={settings.detour}
            onChange={(detour) => update({ detour })}
          />
        </SettingItem>
        <SettingItem
          title="안전 여유"
          description="막차보다 이만큼 일찍 정류장에 도착하게 안내해요"
        >
          <SegmentedControl
            label="안전 여유"
            options={MARGIN_OPTIONS}
            value={settings.safetyMarginMinutes}
            onChange={(safetyMarginMinutes) => update({ safetyMarginMinutes })}
          />
        </SettingItem>
        <SettingItem title="걷는 속도">
          <SegmentedControl
            label="걷는 속도"
            options={WALK_SPEED_OPTIONS}
            value={settings.walkSpeed}
            onChange={(walkSpeed) => update({ walkSpeed })}
          />
        </SettingItem>

        <div className="flex flex-col items-center gap-1.5 px-5 pt-5">
          <Button
            variant="ghost"
            size="xl"
            className="w-full"
            onClick={() => userSettings.write(null)}
          >
            기본값으로 되돌리기
          </Button>
          <p className="text-xs text-subtle-foreground">설정과 집 위치는 이 기기에만 저장돼요</p>
        </div>
      </main>
    </>
  );
}
