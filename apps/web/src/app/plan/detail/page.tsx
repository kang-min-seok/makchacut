import { Suspense } from 'react';
import { PlanLoading } from '@/components/plan/plan-states';
import { WayDetailScreen } from '@/components/way-detail/way-detail-screen';

export default function WayDetailPage() {
  return (
    <Suspense fallback={<PlanLoading />}>
      <WayDetailScreen />
    </Suspense>
  );
}
