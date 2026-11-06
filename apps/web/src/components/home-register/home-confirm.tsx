import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Place } from '@/lib/place';

type HomeConfirmProps = {
  place: Place;
  onSave: () => void;
  onSearchAgain: () => void;
};

export function HomeConfirm({ place, onSave, onSearchAgain }: HomeConfirmProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-[13px] font-bold text-primary">이 위치가 집 맞나요?</p>
        <h2 className="text-[22px] font-bold">{place.name}</h2>
        <p className="text-sm text-muted-foreground">{place.address}</p>
      </div>
      <p className="flex items-center gap-1.5 text-[13px] text-subtle-foreground">
        <Info aria-hidden className="size-4" />집 반경 1km 안의 정류장과 역으로 계산해요
      </p>
      <div className="flex flex-col gap-2">
        <Button size="xl" onClick={onSave}>
          여기를 집으로 저장
        </Button>
        <Button size="xl" variant="ghost" onClick={onSearchAgain}>
          다시 검색
        </Button>
      </div>
    </section>
  );
}
