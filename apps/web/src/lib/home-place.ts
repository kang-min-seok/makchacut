import { PlaceSchema } from '@/lib/place';
import { createStoredValue } from '@/lib/storage/stored-value';

// 집 위치는 이 브라우저에만 둔다 (서버에 저장하지 않음)
export const homePlace = createStoredValue('makchacut:home', PlaceSchema);
