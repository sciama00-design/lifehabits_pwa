-- Run only this SELECT in Supabase SQL Editor; export its single result.
-- Reads job metadata only. Never returns command text, headers or token values.
-- A decoded JWT role describes configuration, not a verified credential:
-- it does not prove signature validity, expiry or equality to the server key.
WITH selected_job AS (
  SELECT jobname, schedule, active, command
  FROM cron.job
  WHERE jobname = 'push-scheduler-job'
), extracted AS (
  SELECT *,
    (regexp_match(command, '/functions/v1/([A-Za-z0-9_-]+)'))[1] AS target_function,
    (regexp_match(command, '(?i)Bearer[[:space:]]+[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+'))[1] AS jwt_payload,
    command ~* 'vault\.' AS references_vault,
    command ~* 'net\.http_post[[:space:]]*\(' AS uses_http_post
  FROM selected_job
), decoded AS (
  SELECT *, CASE
    WHEN jwt_payload IS NOT NULL AND length(jwt_payload) % 4 IN (0, 2, 3)
    THEN encode(decode(
      translate(jwt_payload, '-_', '+/')
      || repeat('=', (4 - length(jwt_payload) % 4) % 4),
      'base64'
    ), 'escape')
  END AS payload_text
  FROM extracted
), classified AS (
  SELECT *, CASE WHEN pg_input_is_valid(payload_text, 'jsonb')
    THEN payload_text::jsonb ->> 'role'
  END AS claimed_role
  FROM decoded
)
SELECT jobname, schedule, active, target_function, uses_http_post,
  CASE
    WHEN claimed_role IN ('anon', 'authenticated', 'service_role') THEN claimed_role
    WHEN references_vault THEN 'riferimento Vault: tipo non determinato'
    WHEN jwt_payload IS NOT NULL THEN 'JWT: ruolo non riconosciuto'
    ELSE 'credenziale non determinata'
  END AS credential_type
FROM classified;
