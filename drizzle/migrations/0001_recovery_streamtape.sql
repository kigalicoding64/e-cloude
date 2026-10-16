ALTER TABLE public.user_security
  ADD COLUMN IF NOT EXISTS recovery_email text,
  ADD COLUMN IF NOT EXISTS recovery_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_locked_until timestamptz;

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'cloud',
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_admin_all ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO service_role;