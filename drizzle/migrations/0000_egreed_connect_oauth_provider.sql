CREATE TABLE public.oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  client_id text NOT NULL UNIQUE,
  client_secret_hash text,
  secret_last_four text,
  client_type text NOT NULL DEFAULT 'confidential',
  redirect_uris text[] NOT NULL DEFAULT '{}',
  scopes text[] NOT NULL DEFAULT ARRAY['openid','profile','email'],
  homepage_url text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_clients TO authenticated;
GRANT ALL ON public.oauth_clients TO service_role;
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY oauth_clients_own ON public.oauth_clients FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER oauth_clients_updated_at BEFORE UPDATE ON public.oauth_clients FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE public.oauth_signing_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid text NOT NULL UNIQUE,
  alg text NOT NULL DEFAULT 'RS256',
  public_jwk jsonb NOT NULL,
  private_jwk jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.oauth_signing_keys TO service_role;
ALTER TABLE public.oauth_signing_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.oauth_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  client_id text NOT NULL,
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  nonce text,
  code_challenge text,
  code_challenge_method text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.oauth_authorization_codes TO service_role;
ALTER TABLE public.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  user_id uuid,
  access_token_hash text NOT NULL UNIQUE,
  refresh_token_hash text UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  grant_type text NOT NULL DEFAULT 'authorization_code',
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX oauth_tokens_user_idx ON public.oauth_tokens (user_id);
GRANT ALL ON public.oauth_tokens TO service_role;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.oauth_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);
GRANT SELECT, DELETE ON public.oauth_consents TO authenticated;
GRANT ALL ON public.oauth_consents TO service_role;
ALTER TABLE public.oauth_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY consents_read_own ON public.oauth_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY consents_delete_own ON public.oauth_consents FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER oauth_consents_updated_at BEFORE UPDATE ON public.oauth_consents FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();