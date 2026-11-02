export type HeadwayRange = {
  min: number;
  max: number;
};

// 0·음수는 정보 없음으로 보고 뺀다
export function headwayRange(values: readonly number[]): HeadwayRange | undefined {
  const known = values.filter((value) => value > 0);
  if (known.length === 0) return undefined;
  return { min: Math.min(...known), max: Math.max(...known) };
}
