import type { DayType } from '@makchacut/core';
import type { Db } from '@makchacut/db';
import type { ApiBudget } from '#jobs/api-budget';
import type { IngestSource, IngestTargetRow, TargetKey } from '#jobs/ingest-targets';

export type IngestKeys = {
  dataGoKr: string;
  seoulOpenData: string;
};

export type IngestContext = {
  db: Db;
  budget: ApiBudget;
  keys: IngestKeys;
  now: Date;
  // 한국 날짜 "YYYY-MM-DD"와 그날의 요일 유형 (서울 버스 "금일" 값을 저장할 요일)
  today: string;
  todayType: DayType;
};

// 출처 하나의 수집 방법. 목록 API로 대상을 정하고, 대상 하나씩 받아 DB에 쓴다.
export type SourceIngester = {
  source: IngestSource;
  // 이 출처가 하루에 쓸 수 있는 외부 호출 수
  dailyQuota: number;
  // 목록을 다시 받는 주기
  listRefreshHours: number;
  // 같은 대상을 다시 받기까지 최소 간격
  targetRefreshHours: number;
  listTargets: (ctx: IngestContext) => Promise<TargetKey[]>;
  // 쓴 행 수를 돌려준다
  ingestTarget: (ctx: IngestContext, target: IngestTargetRow) => Promise<number>;
};
