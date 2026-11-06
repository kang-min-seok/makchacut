import { type DayType, type GraphIndex, indexGraph, type TransitGraph } from '@makchacut/core';
import type { Db } from '@makchacut/db';
import { decodeGraphSnapshot } from '#graph/graph-snapshot';
import { loadGraphSnapshot, loadGraphSnapshotBuiltAt } from '#graph/stores/graph-snapshot-store';

// 요일 유형별 그래프를 함수 인스턴스 메모리에 둔다. 일정 간격마다 DB의 만든 시각만 확인해 바뀌면 다시 읽는다.

export const GRAPH_RECHECK_MS = 10 * 60 * 1000;

export type LoadedGraph = {
  graph: TransitGraph;
  index: GraphIndex;
  // 스냅샷을 만든 시각 (캐시 키에 쓴다)
  version: string;
};

type Entry = { loaded: LoadedGraph; checkedAt: number };

export type GraphCache = {
  get(dayType: DayType): Promise<LoadedGraph | undefined>;
};

export function createGraphCache(db: Db, now: () => number = Date.now): GraphCache {
  const entries = new Map<DayType, Entry>();
  const pending = new Map<DayType, Promise<LoadedGraph | undefined>>();

  async function load(dayType: DayType): Promise<LoadedGraph | undefined> {
    const cached = entries.get(dayType);
    if (cached) {
      const builtAt = await loadGraphSnapshotBuiltAt(db, dayType);
      if (builtAt?.toISOString() === cached.loaded.version) {
        cached.checkedAt = now();
        return cached.loaded;
      }
    }
    const snapshot = await loadGraphSnapshot(db, dayType);
    if (!snapshot) return undefined;
    const graph = decodeGraphSnapshot(snapshot.data);
    const loaded = { graph, index: indexGraph(graph), version: snapshot.builtAt.toISOString() };
    entries.set(dayType, { loaded, checkedAt: now() });
    return loaded;
  }

  return {
    async get(dayType) {
      const cached = entries.get(dayType);
      if (cached && now() - cached.checkedAt < GRAPH_RECHECK_MS) return cached.loaded;
      const inFlight = pending.get(dayType);
      if (inFlight) return inFlight;
      const loading = load(dayType).finally(() => pending.delete(dayType));
      pending.set(dayType, loading);
      return loading;
    },
  };
}
