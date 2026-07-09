
-- 1. Chunked upload sessions
CREATE TABLE public.upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  total_size BIGINT NOT NULL,
  chunk_size INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  uploaded_chunks INTEGER[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active', -- active | completed | aborted | expired
  storage_prefix TEXT NOT NULL, -- uploads/{sessionId}/
  file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  password_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_sessions TO authenticated;
GRANT ALL ON public.upload_sessions TO service_role;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own upload sessions" ON public.upload_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_upload_sessions_user ON public.upload_sessions(user_id);
CREATE TRIGGER trg_upload_sessions_updated BEFORE UPDATE ON public.upload_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 2. File-level lock (password + PIN)
ALTER TABLE public.files
  ADD COLUMN password_hash TEXT,
  ADD COLUMN pin_hash TEXT;

-- 3. Per-user security settings
CREATE TABLE public.user_security (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_secret TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT false,
  totp_pending_secret TEXT, -- during enroll before verify
  backup_codes_hashed TEXT[] NOT NULL DEFAULT '{}',
  app_pin_hash TEXT,
  app_pin_enabled BOOLEAN NOT NULL DEFAULT false,
  require_2fa_for_sensitive BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_security TO authenticated;
GRANT ALL ON public.user_security TO service_role;
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;
-- Users can read their own row but NOT the sensitive secret columns via anon/api.
-- We rely on the client only reading via server functions; policies scoped to owner.
CREATE POLICY "own security row" ON public.user_security
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Restrict direct client SELECT on secret columns
REVOKE SELECT (totp_secret, totp_pending_secret, backup_codes_hashed, app_pin_hash)
  ON public.user_security FROM authenticated, anon;
CREATE TRIGGER trg_user_security_updated BEFORE UPDATE ON public.user_security
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 4. Passkeys (WebAuthn credentials)
CREATE TABLE public.user_passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] NOT NULL DEFAULT '{}',
  device_type TEXT,
  backed_up BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_passkeys TO authenticated;
GRANT ALL ON public.user_passkeys TO service_role;
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own passkeys" ON public.user_passkeys
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Hide public_key material from client SELECT (only needed server-side)
REVOKE SELECT (public_key, counter) ON public.user_passkeys FROM authenticated, anon;
CREATE INDEX idx_user_passkeys_user ON public.user_passkeys(user_id);

-- 5. WebAuthn challenges (short-lived)
CREATE TABLE public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  purpose TEXT NOT NULL, -- 'register' | 'authenticate'
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.webauthn_challenges TO authenticated;
GRANT ALL ON public.webauthn_challenges TO service_role;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own challenges" ON public.webauthn_challenges
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 6. Sensitive-action step-up grants (short-lived 2FA proof)
CREATE TABLE public.sensitive_action_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL, -- e.g. 'api_keys', 'file_delete', 'security_settings', 'all'
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.sensitive_action_grants TO authenticated;
GRANT ALL ON public.sensitive_action_grants TO service_role;
ALTER TABLE public.sensitive_action_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own grants" ON public.sensitive_action_grants
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_sag_user ON public.sensitive_action_grants(user_id, expires_at);

-- 7. Helper: check user has valid sensitive-action grant
CREATE OR REPLACE FUNCTION public.has_sensitive_grant(_user_id UUID, _scope TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sensitive_action_grants
    WHERE user_id = _user_id
      AND (scope = _scope OR scope = 'all')
      AND expires_at > now()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_sensitive_grant(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_sensitive_grant(UUID, TEXT) TO authenticated;
