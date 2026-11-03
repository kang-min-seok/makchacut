import { describe, expect, it } from 'vitest';
import { httpError, previewBody } from '#http-error';

describe('previewBody', () => {
  it('keeps the visible text of an HTML maintenance page', () => {
    const html =
      '<html><head><style>p{color:red}</style><title>점검 안내</title></head>' +
      '<body><p>서비스   점검 중입니다</p></body></html>';
    expect(previewBody(html)).toBe('점검 안내 서비스 점검 중입니다');
  });

  it('masks key parameters and the given secrets', () => {
    const body = 'Bad request: /api?serviceKey=abc%2Bdef&busRouteId=1 key=raw+key/x';
    const preview = previewBody(body, ['raw+key/x', 'abc+def']);
    expect(preview).toContain('serviceKey=***');
    expect(preview).toContain('busRouteId=1');
    expect(preview).not.toContain('abc');
    expect(preview).not.toContain('raw+key');
  });

  it('cuts long bodies short', () => {
    expect(previewBody('a'.repeat(1_000)).length).toBeLessThan(200);
  });
});

describe('httpError', () => {
  it('includes the status and the body preview', async () => {
    const res = new Response('<h1>Service Unavailable</h1>', { status: 503 });
    const error = await httpError('서울 버스 busRouteInfo/getStaionByRoute', res);
    expect(error.message).toBe(
      '서울 버스 busRouteInfo/getStaionByRoute HTTP 503: Service Unavailable',
    );
  });

  it('leaves out the preview when the body is empty', async () => {
    const error = await httpError('GBIS web', new Response('', { status: 502 }));
    expect(error.message).toBe('GBIS web HTTP 502');
  });
});
