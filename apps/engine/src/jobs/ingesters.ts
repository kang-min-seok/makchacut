import type { IngestSource } from '#jobs/ingest-targets';
import { gbisIngester } from '#jobs/sources/gbis';
import { gbisWebIngester } from '#jobs/sources/gbis-web';
import { holidayIngester } from '#jobs/sources/holiday';
import { seoulBusIngester } from '#jobs/sources/seoul-bus';
import { seoulSubwayIngester } from '#jobs/sources/seoul-subway';
import type { SourceIngester } from '#jobs/sources/source-ingester';

export const INGESTERS: Record<IngestSource, SourceIngester> = {
  seoul_bus: seoulBusIngester,
  gbis: gbisIngester,
  gbis_web: gbisWebIngester,
  seoul_subway: seoulSubwayIngester,
  holiday: holidayIngester,
};

export function isIngestSource(value: string): value is IngestSource {
  return Object.hasOwn(INGESTERS, value);
}
