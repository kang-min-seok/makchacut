import { gunzipSync, gzipSync } from 'node:zlib';
import type { TransitGraph } from '@makchacut/core';

// 그래프 스냅샷 바이너리: "MKG1" + 머리말 길이(uint32 LE) + 머리말 JSON + 8바이트 정렬된 타입 배열들, 전체 gzip.

const MAGIC = 'MKG1';
const MAGIC_BYTES = 4;
const LENGTH_BYTES = 4;
const ALIGNMENT = 8;

const TYPED_ARRAYS = {
  Int32Array,
  Float32Array,
  Uint8Array,
} as const;
type TypedArrayName = keyof typeof TYPED_ARRAYS;
type GraphTypedArray = Int32Array | Float32Array | Uint8Array;

type ArrayKey = {
  [K in keyof TransitGraph]: TransitGraph[K] extends GraphTypedArray ? K : never;
}[keyof TransitGraph];
type StringKey = {
  [K in keyof TransitGraph]: TransitGraph[K] extends string[] ? K : never;
}[keyof TransitGraph];

const ARRAY_KEYS: readonly ArrayKey[] = [
  'stopIds',
  'stopLats',
  'stopLngs',
  'patternRouteIds',
  'patternModes',
  'patternStopOffsets',
  'patternStops',
  'patternTripOffsets',
  'patternTimeOffsets',
  'patternHeadwayMinutes',
  'arrivals',
  'departures',
  'timeSources',
  'timeConfidences',
  'footpathFrom',
  'footpathTo',
  'footpathSeconds',
];
const STRING_KEYS: readonly StringKey[] = ['stopNames', 'patternRouteNames', 'tripLabels'];

type ArrayEntry = { key: ArrayKey; type: TypedArrayName; length: number };
type SnapshotHeader = {
  strings: Record<StringKey, string[]>;
  arrays: ArrayEntry[];
};

function typeNameOf(array: GraphTypedArray): TypedArrayName {
  if (array instanceof Int32Array) return 'Int32Array';
  if (array instanceof Float32Array) return 'Float32Array';
  return 'Uint8Array';
}

const align = (offset: number) => Math.ceil(offset / ALIGNMENT) * ALIGNMENT;

function isKnownEntry(entry: ArrayEntry): boolean {
  return (
    Object.hasOwn(TYPED_ARRAYS, entry.type) &&
    ARRAY_KEYS.includes(entry.key) &&
    Number.isInteger(entry.length) &&
    entry.length >= 0
  );
}

export function encodeGraphSnapshot(graph: TransitGraph): Buffer {
  const header: SnapshotHeader = {
    strings: Object.fromEntries(STRING_KEYS.map((key) => [key, graph[key]])) as Record<
      StringKey,
      string[]
    >,
    arrays: ARRAY_KEYS.map((key) => ({
      key,
      type: typeNameOf(graph[key]),
      length: graph[key].length,
    })),
  };
  const headerBytes = Buffer.from(JSON.stringify(header), 'utf8');
  const parts: Buffer[] = [Buffer.from(MAGIC, 'ascii'), Buffer.alloc(LENGTH_BYTES), headerBytes];
  parts[1]!.writeUInt32LE(headerBytes.length);
  let offset = MAGIC_BYTES + LENGTH_BYTES + headerBytes.length;
  for (const key of ARRAY_KEYS) {
    const padded = align(offset);
    parts.push(Buffer.alloc(padded - offset));
    const array = graph[key];
    parts.push(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
    offset = padded + array.byteLength;
  }
  return gzipSync(Buffer.concat(parts));
}

export function decodeGraphSnapshot(snapshot: Uint8Array): TransitGraph {
  const raw = gunzipSync(snapshot);
  if (raw.toString('ascii', 0, MAGIC_BYTES) !== MAGIC) {
    throw new Error('그래프 스냅샷 형식이 아닙니다');
  }
  const headerLength = raw.readUInt32LE(MAGIC_BYTES);
  const headerStart = MAGIC_BYTES + LENGTH_BYTES;
  const header = JSON.parse(
    raw.toString('utf8', headerStart, headerStart + headerLength),
  ) as SnapshotHeader;

  const arrays: Partial<Record<ArrayKey, GraphTypedArray>> = {};
  let offset = headerStart + headerLength;
  for (const entry of header.arrays) {
    if (!isKnownEntry(entry)) {
      throw new Error(`그래프 스냅샷 머리말의 배열 항목이 잘못됐습니다: ${JSON.stringify(entry)}`);
    }
    const Ctor = TYPED_ARRAYS[entry.type];
    const start = align(offset);
    const byteLength = entry.length * Ctor.BYTES_PER_ELEMENT;
    if (start + byteLength > raw.length) {
      throw new Error(`그래프 스냅샷이 잘렸습니다: ${entry.key}`);
    }
    // 정렬을 보장하려고 복사한다
    const bytes = raw.buffer.slice(raw.byteOffset + start, raw.byteOffset + start + byteLength);
    arrays[entry.key] = new Ctor(bytes);
    offset = start + byteLength;
  }
  const missing = ARRAY_KEYS.filter((key) => !arrays[key]);
  if (missing.length > 0) throw new Error(`그래프 스냅샷에 배열이 없습니다: ${missing.join(', ')}`);
  return { ...header.strings, ...arrays } as TransitGraph;
}
