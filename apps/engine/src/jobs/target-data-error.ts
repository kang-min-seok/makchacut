// 원천 API는 정상 응답했지만 그 대상의 데이터를 쓸 수 없을 때(순번 불일치, 목록에 없는 노선 등).
// 원천 장애 신호가 아니므로 연속 실패로 세지 않는다.
export class TargetDataError extends Error {
  override name = 'TargetDataError';
}
