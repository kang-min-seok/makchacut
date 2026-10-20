'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlanRequest } from '@/hooks/use-plan-request';
import { formatKoreaClock, todayInKorea } from '@/lib/korea-time';
import { createSamplePlanRequest } from '@/lib/sample-plan-request';

export function EngineCheck() {
  const { state, submit } = usePlanRequest();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>엔진 연결 확인</CardTitle>
        <CardDescription>모란역 → 동탄 예시 요청을 엔진으로 보내요 (P0 더미 응답)</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          onClick={() => submit(createSamplePlanRequest(todayInKorea()))}
          disabled={state.status === 'loading'}
        >
          {state.status === 'loading' ? '요청 중…' : '예시 요청 보내기'}
        </Button>

        {state.status === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}

        {state.status === 'success' && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">출발 마감</dt>
            <dd className="font-semibold">{formatKoreaClock(state.plan.deadline)}</dd>
            {state.plan.anchor && (
              <>
                <dt className="text-muted-foreground">핵심 연결</dt>
                <dd>
                  {state.plan.anchor.stopName} {state.plan.anchor.routeName} 막차{' '}
                  {formatKoreaClock(state.plan.anchor.time)}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">메모</dt>
            <dd>{state.plan.notes.join(', ')}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
