-- Additive preparation only; review live schema/ACL and backup before applying.
-- Deploy this before the candidate Edge Functions, independently of RLS changes.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- Additive per-device receipts: keep legacy per-rule logs and all existing rows.
-- A short lease allows retry after a worker crash. As with any external push
-- provider, a crash after delivery but before acknowledgment can still duplicate.
CREATE TABLE IF NOT EXISTS public.push_delivery_receipts (
  delivery_key text PRIMARY KEY,
  claim_token uuid NOT NULL,
  lease_until timestamptz NOT NULL,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_delivery_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_delivery_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_delivery_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.claim_push_delivery(delivery_key text)
RETURNS uuid
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = ''
AS $$
  INSERT INTO public.push_delivery_receipts AS receipt (delivery_key, claim_token, lease_until)
  VALUES ($1, gen_random_uuid(), now() + interval '5 minutes')
  ON CONFLICT (delivery_key) DO UPDATE
    SET claim_token = EXCLUDED.claim_token, lease_until = EXCLUDED.lease_until
    WHERE NOT receipt.delivered AND receipt.lease_until < now()
  RETURNING claim_token;
$$;
REVOKE ALL ON FUNCTION public.claim_push_delivery(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery(text) TO service_role;

COMMIT;
