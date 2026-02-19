-- 1. Identify and delete duplicate subscriptions, keeping only the most recent one for each (user, endpoint) pair.
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, subscription->>'endpoint' 
           ORDER BY created_at DESC
         ) as row_num
  FROM public.push_subscriptions
)
DELETE FROM public.push_subscriptions
WHERE id IN (SELECT id FROM duplicates WHERE row_num > 1);

-- 2. Add a unique index to prevent future duplicates based on user_id and the endpoint URL.
-- Note: We use an index on the expression (subscription->>'endpoint') because 'subscription' is JSONB.
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subs_user_endpoint 
ON public.push_subscriptions (user_id, (subscription->>'endpoint'));

-- 3. (Optional) Cleanup any subscriptions that don't have an endpoint (invalid data)
DELETE FROM public.push_subscriptions
WHERE subscription->>'endpoint' IS NULL;
