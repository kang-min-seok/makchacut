# @makchacut/core

DB·네트워크 없이 도는 순수 계산: 정류장별 막차 추정(`stop-last`), 탐색 그래프(`graph`), 역방향 RAPTOR(`raptor`), 귀가 계획(`plan`).

## 요청 한 건의 흐름

`POST /plan`은 엔진(`apps/engine/src/plan/planner.ts`)이 받아 아래 순서로 core를 부른다.

```
1. 요일 그래프          engine  request-day-type.ts → graph-cache (buildTransitGraph 결과)
2. 진입점               core    plan/access.ts          accessStops ×2 (집, 약속 장소)
3. 집 쪽 탐색 3종        core    plan/home-search.ts      searchHome — engine home-search-cache.ts가 LRU 캐시
4. 약속 장소 질의        core    plan/plan-trip.ts        planTrip
5. 응답 형태            engine  format-plan.ts · format-way.ts · service-time-iso.ts
```

### planTrip 단계 (`plan/steps/`)

| 순서 | 파일                  | 하는 일                                                  |
| ---- | --------------------- | -------------------------------------------------------- |
| 1    | `route-candidates.ts` | 약속 장소 → 집 경로 후보 (경로 + 출발 마감 + 총 소요)    |
| 2    | `detour-filter.ts`    | 우회 판정: 총 소요 ≤ 평시 총 소요 × 배수                 |
| 3    | `anchor.ts`           | 핵심 연결: 막차 판정(`isLastRun`), 경로의 마지막 막차    |
| 4    | `ways-to-anchor.ts`   | 핵심 연결 승차 정류장까지 가는 방법 (재탐색 · 중복 제거) |
| 5    | `detour-option.ts`    | 돌아가는 막차 (우회 한도 밖 가장 늦은 경로와의 차이)     |

타입은 `plan/trip-plan.ts`, 우회 단계·배수·평시 소요는 `plan/detour.ts`.

### 역방향 RAPTOR (`raptor/`)

| 파일                 | 하는 일                                                   |
| -------------------- | --------------------------------------------------------- |
| `reverse-raptor.ts`  | 목적지 초기화와 라운드 루프                               |
| `round.ts`           | 라운드 저장소, 내림 한계·환승 여유                        |
| `search-state.ts`    | 라운드를 넘는 탐색 상태, 목적지 도착 시각 추적, 라벨 기록 |
| `scan-timed.ts`      | 시각 기반 탑승                                            |
| `scan-headway.ts`    | 배차 기반 탑승 (최악 대기)                                |
| `relax-footpaths.ts` | 도보 간선                                                 |
| `labels.ts`          | 정류장의 라운드별 값 조회                                 |
| `journey.ts`         | 구간·경로 타입과 경로 복원                                |

그래프 빌더(`graph/build-graph.ts`)는 운행 다듬기(`prepareTrips`) → 패턴 묶기(`groupPatterns`) → 타입 배열 담기(`packGraph`) 순서다. 시간 단위 상수는 `time/units.ts` 한 곳에 둔다.
