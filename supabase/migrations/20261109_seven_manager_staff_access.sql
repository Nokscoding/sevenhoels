-- Seven : le gérant local (manager) administre ses employés,
-- sans pouvoir attribuer un rôle de direction ou de supervision.
DROP POLICY IF EXISTS seven_roles_manager_read ON public.seven_roles;
CREATE POLICY seven_roles_manager_read ON public.seven_roles
 FOR SELECT TO authenticated
 USING (
   hotel_id IS NOT NULL
   AND role IN ('reception','housekeeping','accountant')
   AND private.seven_has_role(hotel_id,ARRAY['manager'])
 );
DROP POLICY IF EXISTS seven_roles_manager_insert ON public.seven_roles;
CREATE POLICY seven_roles_manager_insert ON public.seven_roles
 FOR INSERT TO authenticated
 WITH CHECK (
   hotel_id IS NOT NULL
   AND role IN ('reception','housekeeping','accountant')
   AND private.seven_has_role(hotel_id,ARRAY['manager'])
 );
DROP POLICY IF EXISTS seven_roles_manager_update ON public.seven_roles;
CREATE POLICY seven_roles_manager_update ON public.seven_roles
 FOR UPDATE TO authenticated
 USING (
   hotel_id IS NOT NULL
   AND role IN ('reception','housekeeping','accountant')
   AND private.seven_has_role(hotel_id,ARRAY['manager'])
 )
 WITH CHECK (
   hotel_id IS NOT NULL
   AND role IN ('reception','housekeeping','accountant')
   AND private.seven_has_role(hotel_id,ARRAY['manager'])
 );