// Postgres 바인드 파라미터 한도(65,535)를 넘지 않게 여러 행 insert를 나눈다
const DEFAULT_CHUNK_SIZE = 1000;

export function chunk<T>(items: readonly T[], size = DEFAULT_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}
