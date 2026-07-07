
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _user_id <> auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = _org_id AND user_id = _user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _user_id <> auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id
    UNION
    SELECT 1 FROM public.organization_members WHERE org_id = _org_id AND user_id = _user_id AND role IN ('admin','owner')
  );
END;
$$;
