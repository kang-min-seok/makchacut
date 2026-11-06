import { buildTransitGraph, type DayType, indexGraph } from '@makchacut/core';
import type { Db } from '@makchacut/db';
import { loadGraphInput } from '#graph/stores/graph-input-store';
import type { GraphCache, LoadedGraph } from '#plan/graph-cache';

// 스냅샷 테이블 없이 DB에서 바로 그래프를 만든다 (점검 스크립트용, 요일 유형마다 7~14초)
export function createDbGraphCache(db: Db): GraphCache {
  const graphs = new Map<DayType, Promise<LoadedGraph>>();
  return {
    get(dayType) {
      let loading = graphs.get(dayType);
      if (!loading) {
        loading = loadGraphInput(db, dayType).then((input) => {
          const { graph } = buildTransitGraph(input);
          return { graph, index: indexGraph(graph), version: `db:${new Date().toISOString()}` };
        });
        graphs.set(dayType, loading);
      }
      return loading;
    },
  };
}
