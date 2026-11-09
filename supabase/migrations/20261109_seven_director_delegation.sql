-- Gestion déléguée : un directeur ne peut attribuer que des rôles subalternes dans son propre établissement.
DROP POLICY IF EXISTS seven_roles_director_read ON public.seven_roles;
CREATE POLICY seven_roles_director_read ON public.seven_roles
 FOR SELECT TO authenticated
 USING (hotel_id IS NOT NULL AND role IN ('manager','reception','housekeeping','accountant') AND private.seven_has_role(hotel_id,ARRAY['director']));
DROP POLICY IF EXISTS seven_roles_director_insert ON public.seven_roles;
CREATE POLICY seven_roles_director_insert ON public.seven_roles
 FOR INSERT TO authenticated
 WITH CHECK (hotel_id IS NOT NULL AND role IN ('manager','reception','housekeeping','accountant') AND private.seven_has_role(hotel_id,ARRAY['director']));
DROP POLICY IF EXISTS seven_roles_director_update ON public.seven_roles;
CREATE POLICY seven_roles_director_update ON public.seven_roles
 FOR UPDATE TO authenticated
 USING (hotel_id IS NOT NULL AND role IN ('manager','reception','housekeeping','accountant') AND private.seven_has_role(hotel_id,ARRAY['director']))
 WITH CHECK (hotel_id IS NOT NULL AND role IN ('manager','reception','housekeeping','accountant') AND private.seven_has_role(hotel_id,ARRAY['director']));
