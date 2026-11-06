import { Suspense } from 'react';
import { PlanLoading } from '@/components/plan/plan-states';
import { PlanScreen } from '@/components/plan/plan-screen';

export default function PlanPage() {
  return (
    <Suspense fallback={<PlanLoading />}>
      <PlanScreen />
    </Suspense>
  );
}
