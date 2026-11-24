-- Allow only approved administrators to edit and delete agenda items.
BEGIN;

GRANT UPDATE, DELETE ON public.atur_cara TO authenticated;

DROP POLICY IF EXISTS agenda_admin_update ON public.atur_cara;
CREATE POLICY agenda_admin_update ON public.atur_cara FOR UPDATE TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS agenda_admin_delete ON public.atur_cara;
CREATE POLICY agenda_admin_delete ON public.atur_cara FOR DELETE TO authenticated
USING ((SELECT public.is_admin()));

COMMIT;
