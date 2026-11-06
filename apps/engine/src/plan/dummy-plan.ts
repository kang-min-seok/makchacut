import type { PlanRequest, PlanResponse } from '@makchacut/shared';

const KST_OFFSET = '+09:00';

function at(date: string, time: string): string {
  return `${date}T${time}:00${KST_OFFSET}`;
}

export function createDummyPlan(request: PlanRequest): PlanResponse {
  const { date, home, meetup } = request;
  return {
    deadline: at(date, '22:17'),
    dayType: 'weekday',
    anchor: {
      routeName: '6003',
      stopName: '판교역',
      time: at(date, '22:50'),
      timeKind: 'scheduled',
      source: 'gbis_eta',
      confidence: 'high',
    },
    ways: [
      {
        latestDeparture: at(date, '22:17'),
        steps: [
          {
            type: 'walk',
            from: '약속 장소',
            to: '모란역 정류장',
            depart: at(date, '22:17'),
            arrive: at(date, '22:22'),
            timeKind: 'estimated',
            path: [meetup],
            isAnchor: false,
          },
          {
            type: 'bus',
            from: '모란역 정류장',
            to: '판교역',
            routeName: '판교행 버스',
            depart: at(date, '22:22'),
            arrive: at(date, '22:43'),
            timeKind: 'estimated',
            path: [],
            isAnchor: false,
          },
          {
            type: 'bus',
            from: '판교역',
            to: '동탄',
            routeName: '6003',
            depart: at(date, '22:50'),
            arrive: at(date, '23:35'),
            timeKind: 'scheduled',
            path: [home],
            isAnchor: true,
          },
        ],
      },
    ],
    detour: null,
    notes: ['dummy-response'],
  };
}
