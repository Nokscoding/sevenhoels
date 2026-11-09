-- Correction : ne pas appeler une fonction privée depuis le rôle anonyme.
DROP POLICY IF EXISTS seven_resources_public_select ON public.seven_service_resources;
DROP POLICY IF EXISTS seven_resources_anon_select ON public.seven_service_resources;
DROP POLICY IF EXISTS seven_resources_staff_select ON public.seven_service_resources;
CREATE POLICY seven_resources_anon_select ON public.seven_service_resources
 FOR SELECT TO anon USING (active=true);
CREATE POLICY seven_resources_staff_select ON public.seven_service_resources
 FOR SELECT TO authenticated USING (active=true OR private.seven_can_access(hotel_id));