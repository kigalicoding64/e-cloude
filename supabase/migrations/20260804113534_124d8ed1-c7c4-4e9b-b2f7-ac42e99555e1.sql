-- 1) webauthn_challenges: remove blanket access to anonymous (NULL user_id) rows
DROP POLICY IF EXISTS "own challenges" ON public.webauthn_challenges;
CREATE POLICY "own challenges" ON public.webauthn_challenges
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) has_sensitive_grant is only used by trusted server code; revoke direct client access
REVOKE ALL ON FUNCTION public.has_sensitive_grant(uuid, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_sensitive_grant(uuid, text) TO service_role;

-- 3) has_role must stay executable for RLS policies, but must not let a user probe others' roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() IS NULL means trusted server-side/service-role execution
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- 4) backup_schedules: make coverage explicit per-command (owner-only, includes delete)
DROP POLICY IF EXISTS "own backups" ON public.backup_schedules;
CREATE POLICY "backup_schedules_select_own" ON public.backup_schedules
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "backup_schedules_insert_own" ON public.backup_schedules
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "backup_schedules_update_own" ON public.backup_schedules
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "backup_schedules_delete_own" ON public.backup_schedules
  FOR DELETE TO authenticated USING (auth.uid() = user_id);