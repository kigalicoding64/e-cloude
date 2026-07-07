
-- 1. Harden has_role to SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 2. Remove overly-broad SELECT policies on shares.
-- Public share resolution goes through server routes using the service role,
-- so anon/authenticated must not be able to enumerate share rows directly.
DROP POLICY IF EXISTS "Anyone can lookup share by token" ON public.shares;
DROP POLICY IF EXISTS "Authenticated lookup share by token" ON public.shares;
