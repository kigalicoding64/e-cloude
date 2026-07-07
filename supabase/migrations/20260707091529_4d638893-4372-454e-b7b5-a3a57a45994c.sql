
-- ============ activity_log ============
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid,
  type text NOT NULL,
  target_id uuid,
  target_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_user_created ON public.activity_log(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity read" ON public.activity_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own activity insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notif" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ backup_schedules ============
CREATE TABLE public.backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sources text[] NOT NULL DEFAULT '{}',
  frequency text NOT NULL DEFAULT 'daily',
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_schedules TO authenticated;
GRANT ALL ON public.backup_schedules TO service_role;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own backups" ON public.backup_schedules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER backup_schedules_updated_at BEFORE UPDATE ON public.backup_schedules FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ organizations ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  storage_quota_gb integer NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ organization_members ============
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Helper function: is user a member of org (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = _org_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id
    UNION
    SELECT 1 FROM public.organization_members WHERE org_id = _org_id AND user_id = _user_id AND role IN ('admin','owner')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated, service_role;

-- organizations policies
CREATE POLICY "org read for members" ON public.organizations FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_org_member(id, auth.uid()));
CREATE POLICY "org create own" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "org update by admin" ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_admin(id, auth.uid())) WITH CHECK (public.is_org_admin(id, auth.uid()));
CREATE POLICY "org delete by owner" ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- organization_members policies
CREATE POLICY "members read same org" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_id, auth.uid()));
CREATE POLICY "members insert by admin" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id, auth.uid()));
CREATE POLICY "members update by admin" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id, auth.uid())) WITH CHECK (public.is_org_admin(org_id, auth.uid()));
CREATE POLICY "members delete by admin or self" ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()) OR user_id = auth.uid());

-- link files/folders to org (optional)
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS idx_files_org ON public.files(org_id);
CREATE INDEX IF NOT EXISTS idx_folders_org ON public.folders(org_id);
