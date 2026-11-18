import { Suspense } from 'react';
import { OtherAnchorsScreen } from '@/components/anchors/other-anchors-screen';
import { PlanLoading } from '@/components/plan/plan-states';

export default function OtherAnchorsPage() {
  return (
    <Suspense fallback={<PlanLoading />}>
      <OtherAnchorsScreen />
    </Suspense>
  );
}
