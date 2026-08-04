ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['read','download','upload','manage']::text[];

ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_scopes_valid CHECK (
    scopes <@ ARRAY['read','download','upload','manage']::text[] AND array_length(scopes, 1) >= 1
  );

CREATE TABLE IF NOT EXISTS public.api_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  endpoint text NOT NULL,
  request_fingerprint text,
  status integer,
  response jsonb,
  state text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint, idempotency_key)
);

GRANT SELECT, DELETE ON public.api_idempotency_records TO authenticated;
GRANT ALL ON public.api_idempotency_records TO service_role;

ALTER TABLE public.api_idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their idempotency records"
  ON public.api_idempotency_records FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their idempotency records"
  ON public.api_idempotency_records FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_api_idempotency_updated
  BEFORE UPDATE ON public.api_idempotency_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE INDEX IF NOT EXISTS idx_api_idempotency_lookup
  ON public.api_idempotency_records (user_id, endpoint, idempotency_key);