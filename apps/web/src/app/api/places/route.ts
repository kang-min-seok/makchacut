import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { PLACE_QUERY_MAX_LENGTH, PLACE_QUERY_MIN_LENGTH, PLACE_QUERY_PARAM } from '@/lib/place';
import { searchPlaces } from '@/server/place-search';

const BAD_REQUEST = 400;
const BAD_GATEWAY = 502;

const QuerySchema = z.string().trim().min(PLACE_QUERY_MIN_LENGTH).max(PLACE_QUERY_MAX_LENGTH);

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse(request.nextUrl.searchParams.get(PLACE_QUERY_PARAM));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_query' }, { status: BAD_REQUEST });
  }
  try {
    return Response.json({ places: await searchPlaces(parsed.data) });
  } catch (error) {
    console.error('place search failed', error);
    return Response.json({ error: 'search_unavailable' }, { status: BAD_GATEWAY });
  }
}
