import { sql } from 'drizzle-orm';
import type { Footpath, FootpathStop } from '@makchacut/core';
import { type DbExecutor, footpath, stop } from '@makchacut/db';
import { chunk } from '#jobs/stores/chunk';
import { pgArray, UNNEST_CHUNK_SIZE, unnestColumns } from '#compute/stores/pg-array';

export async function loadFootpathStops(db: DbExecutor): Promise<FootpathStop[]> {
  return db
    .select({ id: stop.id, mode: stop.mode, name: stop.name, lat: stop.lat, lng: stop.lng })
    .from(stop);
}

export async function countFootpaths(db: DbExecutor): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(footpath);
  return row?.count ?? 0;
}

// 전체를 다시 쓴다 (트랜잭션 안에서 부른다)
export async function replaceFootpaths(db: DbExecutor, paths: readonly Footpath[]): Promise<void> {
  await db.delete(footpath);
  for (const rows of chunk(paths, UNNEST_CHUNK_SIZE)) {
    const columns = unnestColumns([
      { values: pgArray(rows.map((r) => r.fromStopId)), type: 'int' },
      { values: pgArray(rows.map((r) => r.toStopId)), type: 'int' },
      { values: pgArray(rows.map((r) => r.walkSeconds)), type: 'int' },
    ]);
    await db.execute(sql`
      insert into ${footpath} (from_stop_id, to_stop_id, walk_seconds)
      select * from unnest(${columns})
    `);
  }
}
