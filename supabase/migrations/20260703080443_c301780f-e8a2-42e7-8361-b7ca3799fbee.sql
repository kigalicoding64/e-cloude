
CREATE TABLE public.ai_orchestrators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url text NOT NULL,
  region text,
  gpu_type text,
  status text NOT NULL DEFAULT 'unknown',
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_orchestrators TO authenticated;
GRANT ALL ON public.ai_orchestrators TO service_role;
ALTER TABLE public.ai_orchestrators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage orchestrators" ON public.ai_orchestrators
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  source_repo text,
  source_ref text DEFAULT 'main',
  framework text,
  task text,
  gpu_type text,
  memory_mb integer DEFAULT 4096,
  status text NOT NULL DEFAULT 'draft',
  endpoint_path text,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_models TO authenticated;
GRANT ALL ON public.ai_models TO service_role;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own models" ON public.ai_models
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins view all models" ON public.ai_models
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ai_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  orchestrator_id uuid REFERENCES public.ai_orchestrators(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  container_id text,
  host text,
  gpu_util numeric,
  memory_used_mb integer,
  error text,
  started_at timestamptz,
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_deployments TO authenticated;
GRANT ALL ON public.ai_deployments TO service_role;
ALTER TABLE public.ai_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own deployments" ON public.ai_deployments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_models m WHERE m.id = model_id AND m.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_models m WHERE m.id = model_id AND m.owner_id = auth.uid()));
CREATE POLICY "Admins view all deployments" ON public.ai_deployments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ai_deployment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES public.ai_deployments(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_deployment_events TO authenticated;
GRANT ALL ON public.ai_deployment_events TO service_role;
ALTER TABLE public.ai_deployment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner view own events" ON public.ai_deployment_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_deployments d
    JOIN public.ai_models m ON m.id = d.model_id
    WHERE d.id = deployment_id AND m.owner_id = auth.uid()
  ));
CREATE POLICY "Admins view all events" ON public.ai_deployment_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ai_gateway_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  key_hash text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_gateway_keys TO authenticated;
GRANT ALL ON public.ai_gateway_keys TO service_role;
ALTER TABLE public.ai_gateway_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own gateway keys" ON public.ai_gateway_keys
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_ai_orchestrators_updated BEFORE UPDATE ON public.ai_orchestrators
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_ai_models_updated BEFORE UPDATE ON public.ai_models
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_ai_deployments_updated BEFORE UPDATE ON public.ai_deployments
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE INDEX idx_ai_models_owner ON public.ai_models(owner_id);
CREATE INDEX idx_ai_deployments_model ON public.ai_deployments(model_id);
CREATE INDEX idx_ai_events_deployment ON public.ai_deployment_events(deployment_id, created_at DESC);
CREATE INDEX idx_ai_keys_owner ON public.ai_gateway_keys(owner_id);
