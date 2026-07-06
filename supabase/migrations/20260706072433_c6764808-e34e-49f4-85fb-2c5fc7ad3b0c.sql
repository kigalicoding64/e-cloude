
-- Versions
CREATE TABLE public.ai_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  git_ref text NOT NULL,
  commit_sha text,
  source_repo text,
  deployment_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_versions TO authenticated;
GRANT ALL ON public.ai_model_versions TO service_role;
ALTER TABLE public.ai_model_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages versions" ON public.ai_model_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_models m WHERE m.id = model_id AND m.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_models m WHERE m.id = model_id AND m.owner_id = auth.uid()));
CREATE POLICY "Admins manage all versions" ON public.ai_model_versions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_ai_versions_model ON public.ai_model_versions(model_id, created_at DESC);

-- Metrics (time-series)
CREATE TABLE public.ai_metrics (
  id bigserial PRIMARY KEY,
  deployment_id uuid NOT NULL REFERENCES public.ai_deployments(id) ON DELETE CASCADE,
  gpu_util numeric,
  memory_used_mb integer,
  vram_used_mb integer,
  tokens_per_sec numeric,
  measured_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_metrics TO authenticated;
GRANT ALL ON public.ai_metrics TO service_role;
ALTER TABLE public.ai_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner view own metrics" ON public.ai_metrics
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_deployments d
    JOIN public.ai_models m ON m.id = d.model_id
    WHERE d.id = deployment_id AND m.owner_id = auth.uid()
  ));
CREATE POLICY "Admins view all metrics" ON public.ai_metrics
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_ai_metrics_deployment ON public.ai_metrics(deployment_id, measured_at DESC);

-- Gateway request log
CREATE TABLE public.ai_gateway_requests (
  id bigserial PRIMARY KEY,
  key_id uuid REFERENCES public.ai_gateway_keys(id) ON DELETE SET NULL,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  deployment_id uuid REFERENCES public.ai_deployments(id) ON DELETE SET NULL,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  latency_ms integer,
  status integer NOT NULL DEFAULT 200,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_gateway_requests TO authenticated;
GRANT ALL ON public.ai_gateway_requests TO service_role;
ALTER TABLE public.ai_gateway_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner view own gateway requests" ON public.ai_gateway_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_gateway_keys k
    WHERE k.id = key_id AND k.owner_id = auth.uid()
  ));
CREATE POLICY "Admins view all gateway requests" ON public.ai_gateway_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_ai_gw_req_key ON public.ai_gateway_requests(key_id, created_at DESC);
CREATE INDEX idx_ai_gw_req_model ON public.ai_gateway_requests(model_id, created_at DESC);

-- Extend deployments
ALTER TABLE public.ai_deployments
  ADD COLUMN version_id uuid REFERENCES public.ai_model_versions(id) ON DELETE SET NULL,
  ADD COLUMN tokens_per_sec numeric,
  ADD COLUMN total_tokens bigint NOT NULL DEFAULT 0;

-- Extend gateway keys with rate limit + quota
ALTER TABLE public.ai_gateway_keys
  ADD COLUMN rate_limit_per_min integer NOT NULL DEFAULT 60,
  ADD COLUMN quota_tokens_month bigint NOT NULL DEFAULT 1000000,
  ADD COLUMN tokens_used_month bigint NOT NULL DEFAULT 0,
  ADD COLUMN quota_reset_at timestamptz NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month';

-- Orchestrator agent token
ALTER TABLE public.ai_orchestrators
  ADD COLUMN agent_token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');
