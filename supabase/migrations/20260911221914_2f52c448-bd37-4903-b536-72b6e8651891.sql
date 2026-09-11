CREATE TABLE public.deployment_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  passed BOOLEAN NOT NULL DEFAULT false,
  missing_bindings TEXT[] NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX deployment_verifications_created_at_idx ON public.deployment_verifications (created_at DESC);

GRANT SELECT ON public.deployment_verifications TO authenticated;
GRANT ALL ON public.deployment_verifications TO service_role;

ALTER TABLE public.deployment_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view deployment verifications"
ON public.deployment_verifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));