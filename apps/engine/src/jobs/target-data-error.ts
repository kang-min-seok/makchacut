// markFailure가 String(error)로 남기는 접두사. 빌드에서 클래스 이름이 바뀌어도 유지되게 상수로 둔다.
export const TARGET_DATA_ERROR_NAME = 'TargetDataError';

// 원천 API는 정상 응답했지만 그 대상의 데이터를 쓸 수 없을 때(순번 불일치, 목록에 없는 노선 등).
// 원천 장애 신호가 아니므로 연속 실패로 세지 않는다.
export class TargetDataError extends Error {
  override name = TARGET_DATA_ERROR_NAME;
}
