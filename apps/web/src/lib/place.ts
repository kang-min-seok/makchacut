import { z } from 'zod';
import { LatLngSchema } from '@makchacut/shared';

// 검색으로 고른 장소 (집·약속 장소)
export const PlaceSchema = LatLngSchema.extend({
  id: z.string(),
  name: z.string().min(1),
  address: z.string(),
});

export type Place = z.infer<typeof PlaceSchema>;

export const PlaceSearchResponseSchema = z.object({ places: z.array(PlaceSchema) });

export const PLACE_SEARCH_PATH = '/api/places';
export const PLACE_QUERY_PARAM = 'q';
export const PLACE_QUERY_MIN_LENGTH = 2;
export const PLACE_QUERY_MAX_LENGTH = 60;
