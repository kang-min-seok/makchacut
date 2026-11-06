'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  type Place,
  PLACE_QUERY_MIN_LENGTH,
  PLACE_QUERY_PARAM,
  PLACE_SEARCH_PATH,
  PlaceSearchResponseSchema,
} from '@/lib/place';

const DEBOUNCE_MS = 250;

async function fetchPlaces(query: string): Promise<Place[]> {
  const params = new URLSearchParams({ [PLACE_QUERY_PARAM]: query });
  const res = await fetch(`${PLACE_SEARCH_PATH}?${params.toString()}`);
  if (!res.ok) throw new Error(`place search ${res.status}`);
  return PlaceSearchResponseSchema.parse(await res.json()).places;
}

export function usePlaceSearch(input: string) {
  const trimmed = input.trim();
  const query = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const enabled = query.length >= PLACE_QUERY_MIN_LENGTH;
  const result = useQuery({
    queryKey: ['places', query],
    queryFn: () => fetchPlaces(query),
    enabled,
    placeholderData: keepPreviousData,
  });
  const isSearching = query !== trimmed || result.isFetching;
  return { ...result, enabled, isSearching };
}
