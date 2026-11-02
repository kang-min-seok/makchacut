import { fetchHolidays } from '@makchacut/data';
import type { IngestContext, SourceIngester } from '#jobs/sources/source-ingester';
import { replaceYearHolidays } from '#jobs/stores/holiday-store';

const DAILY_QUOTA = 100;
const LIST_REFRESH_HOURS = 24;
// 대체공휴일·선거일이 연중에 추가될 수 있어 주 1회 다시 받는다
const TARGET_REFRESH_HOURS = 24 * 7;
const YEAR_LENGTH = 4;

// 올해와 내년
async function listTargets(ctx: IngestContext) {
  const year = Number(ctx.today.slice(0, YEAR_LENGTH));
  return [year, year + 1].map((y) => ({ targetId: String(y), dayType: null }));
}

async function ingestTarget(ctx: IngestContext, target: { targetId: string }) {
  const year = Number(target.targetId);
  const holidays = await ctx.budget.call(() => fetchHolidays(ctx.keys.dataGoKr, year));
  await ctx.db.transaction((tx) => replaceYearHolidays(tx, year, holidays));
  return holidays.length;
}

export const holidayIngester: SourceIngester = {
  source: 'holiday',
  dailyQuota: DAILY_QUOTA,
  listRefreshHours: LIST_REFRESH_HOURS,
  targetRefreshHours: TARGET_REFRESH_HOURS,
  listTargets,
  ingestTarget,
};
