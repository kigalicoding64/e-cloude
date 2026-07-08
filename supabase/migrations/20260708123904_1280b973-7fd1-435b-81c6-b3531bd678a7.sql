
-- 1. Restrict SECURITY DEFINER function EXECUTE privileges to only what policies need.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;

-- Keep authenticated able to invoke functions embedded in RLS policies.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;

-- 2. Hide sensitive key_hash column from client-side SELECT on ai_gateway_keys.
--    Owner can still list / manage keys, but the hash never leaves the server.
REVOKE SELECT (key_hash) ON public.ai_gateway_keys FROM authenticated, anon;
