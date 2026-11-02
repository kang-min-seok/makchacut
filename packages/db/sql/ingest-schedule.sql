-- 수집 스케줄 (Supabase pg_cron + pg_net). drizzle 마이그레이션이 아니라 Supabase SQL Editor에서 한 번 실행한다.
-- 다시 실행해도 된다: cron.schedule은 같은 이름이면 덮어쓴다.
--
-- 사전 준비
--   1. Database → Extensions에서 pg_cron, pg_net 활성화
--   2. Vault에 두 값을 넣는다 (Project Settings → Vault 또는 아래 SQL)
--        ingest_cron_secret : 엔진 env INGEST_CRON_SECRET과 같은 값 (2026-11-02 등록됨)
--        engine_base_url    : 엔진 Production 주소, 끝에 / 없이 (예: https://makchacut-engine.vercel.app)
--      select vault.create_secret('https://<engine-domain>', 'engine_base_url');
--   3. 이 브랜치가 배포된 뒤에 실행한다 (엔드포인트 POST /jobs/ingest/:source, POST /jobs/compute/:step)
--   4. 지하철역 좌표 보완(compute subway-coords)은 엔진 env KAKAO_REST_API_KEY가 있어야 돈다(없으면 경고만 남기고 건너뜀)
--
-- 시각은 UTC다. 19:00~20:59 UTC = 04:00~05:59 KST.
-- 출처마다 20분 간격 6회, 출처끼리 5분씩 어긋나게 둔다. 엔드포인트는 240초 안에 끝나고,
-- 그날 한도를 다 쓰면 바로 돌아온다(ingest_run.api_calls로 센다).

create or replace function public.call_ingest(source text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'engine_base_url')
      || '/jobs/ingest/' || source,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'ingest_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$$;

-- Data API(anon·authenticated)로는 부를 수 없게 한다
revoke all on function public.call_ingest(text) from public, anon, authenticated;

select cron.schedule('ingest-seoul-bus', '0,20,40 19-20 * * *', $$select public.call_ingest('seoul_bus')$$);
select cron.schedule('ingest-gbis', '5,25,45 19-20 * * *', $$select public.call_ingest('gbis')$$);
select cron.schedule('ingest-gbis-web', '10,30,50 19-20 * * *', $$select public.call_ingest('gbis_web')$$);
select cron.schedule('ingest-seoul-subway', '15,35,55 19-20 * * *', $$select public.call_ingest('seoul_subway')$$);
-- 월요일 06:00 KST
select cron.schedule('ingest-holiday', '0 21 * * 0', $$select public.call_ingest('holiday')$$);

-- 계산 (엔드포인트 POST /jobs/compute/:step) — 수집이 끝난 뒤 06:00~06:20 KST, 앞 단계 결과를 다음 단계가 쓰므로 순서대로 띄운다.
-- 역 좌표 → 정류장 통합 → 정류장별 막차 → 도보 간선. 각 단계는 200초 안에 끝나고 전체를 다시 계산하므로 다시 불러도 된다.
create or replace function public.call_compute(step text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'engine_base_url')
      || '/jobs/compute/' || step,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'ingest_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$$;

revoke all on function public.call_compute(text) from public, anon, authenticated;

select cron.schedule('compute-subway-coords', '0 21 * * *', $$select public.call_compute('subway-coords')$$);
select cron.schedule('compute-merge-stops', '5 21 * * *', $$select public.call_compute('merge-stops')$$);
select cron.schedule('compute-stop-last', '10 21 * * *', $$select public.call_compute('stop-last')$$);
select cron.schedule('compute-footpath', '20 21 * * *', $$select public.call_compute('footpath')$$);

-- 확인
--   select jobname, schedule, active from cron.job order by jobname;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select id, status_code, left(content, 300) from net._http_response order by id desc limit 20;
--   select source, status, api_calls, row_count, started_at from public.ingest_run order by id desc limit 20;
--   계산 경고(행 수 급변, ptts 대체 비율): select source, error_message, started_at from public.ingest_run
--     where source like 'compute:%' and error_message is not null order by id desc limit 20;
