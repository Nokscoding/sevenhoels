-- Seven Hotels / rôle global directeurs et modérateur — 2026-11-09
-- Cette migration ne crée aucun compte, ne change pas les utilisateurs historiques
-- et conserve les établissements, réservations et chambres existants.

BEGIN;

-- Superviseur ET directeurs sont des rôles globaux sans hôtel individuel.
ALTER TABLE public.seven_roles DROP CONSTRAINT IF EXISTS seven_roles_scope;
ALTER TABLE public.seven_roles ADD CONSTRAINT seven_roles_scope
 CHECK (
   (role IN ('supervisor','director') AND hotel_id IS NULL) OR
   (role IN ('manager','reception','housekeeping','accountant') AND hotel_id IS NOT NULL)
 );

CREATE OR REPLACE FUNCTION private.seven_is_director()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.seven_roles r
   WHERE r.user_id=auth.uid() AND r.active=true AND r.role='director'
 );
$fn$;

CREATE OR REPLACE FUNCTION private.seven_is_leadership()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.seven_roles r
   WHERE r.user_id=auth.uid() AND r.active=true AND r.role IN ('supervisor','director')
 );
$fn$;

CREATE OR REPLACE FUNCTION private.seven_can_access(p_hotel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.seven_roles r
   WHERE r.user_id=auth.uid() AND r.active=true
     AND (r.role IN ('supervisor','director') OR r.hotel_id=p_hotel_id)
 );
$fn$;

CREATE OR REPLACE FUNCTION private.seven_has_role(p_hotel_id uuid,p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.seven_roles r
   WHERE r.user_id=auth.uid() AND r.active=true
     AND (r.role IN ('supervisor','director') OR (r.hotel_id=p_hotel_id AND r.role=ANY(p_roles)))
 );
$fn$;

REVOKE ALL ON FUNCTION private.seven_is_director() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.seven_is_leadership() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.seven_is_director() TO authenticated;
GRANT EXECUTE ON FUNCTION private.seven_is_leadership() TO authenticated;

-- Les anciennes politiques métier s'appuient sur ces fonctions.
-- Pour Seven, l'autorité vient exclusivement de seven_roles (pas du
-- rôle historique 'admin' de profiles, sans attribution formelle).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$ SELECT private.seven_is_leadership(); $fn$;

CREATE OR REPLACE FUNCTION public.can_access_hotel(p_hotel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$ SELECT private.seven_can_access(p_hotel_id); $fn$;

-- Un directeur global peut consulter et attribuer les accès de la chaîne
-- (y compris d'autres directeurs), à l'exclusion du superviseur.
DROP POLICY IF EXISTS seven_roles_director_read ON public.seven_roles;
DROP POLICY IF EXISTS seven_roles_director_insert ON public.seven_roles;
DROP POLICY IF EXISTS seven_roles_director_update ON public.seven_roles;
CREATE POLICY seven_roles_director_read ON public.seven_roles
 FOR SELECT TO authenticated
 USING (role <> 'supervisor' AND (SELECT private.seven_is_director()));
CREATE POLICY seven_roles_director_insert ON public.seven_roles
 FOR INSERT TO authenticated
 WITH CHECK (role <> 'supervisor' AND (SELECT private.seven_is_director()));
CREATE POLICY seven_roles_director_update ON public.seven_roles
 FOR UPDATE TO authenticated
 USING (role <> 'supervisor' AND (SELECT private.seven_is_director()))
 WITH CHECK (role <> 'supervisor' AND (SELECT private.seven_is_director()));

-- Le superviseur gère aussi les autres superviseurs. Les gérants gardent
-- leur droit de gérer uniquement les employés subalternes du même hôtel.
-- Empêcher la conversion d'un rôle par UPDATE direct ; créer un nouvel
-- accès autorisé puis désactiver l'ancien pour changer d'affectation.
CREATE OR REPLACE FUNCTION private.seven_role_immutable_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF auth.uid() IS NOT NULL AND (
   NEW.user_id IS DISTINCT FROM OLD.user_id OR
   NEW.hotel_id IS DISTINCT FROM OLD.hotel_id OR
   NEW.role IS DISTINCT FROM OLD.role
 ) THEN
   RAISE EXCEPTION 'role_identity_immutable';
 END IF;
 IF OLD.role='supervisor' AND OLD.active AND NOT NEW.active THEN
   IF (SELECT count(*) FROM public.seven_roles
       WHERE role='supervisor' AND active=true) <= 1 THEN
     RAISE EXCEPTION 'last_supervisor_cannot_be_disabled';
   END IF;
 END IF;
 RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS seven_role_immutable_fields ON public.seven_roles;
CREATE TRIGGER seven_role_immutable_fields
 BEFORE UPDATE ON public.seven_roles
 FOR EACH ROW EXECUTE FUNCTION private.seven_role_immutable_fields();

-- Les directeurs peuvent ouvrir et administrer des établissements, tandis
-- que le modérateur conserve le droit de suppression définitive.
DROP POLICY IF EXISTS hotels_leadership_select ON public.hotels;
CREATE POLICY hotels_leadership_select ON public.hotels
 FOR SELECT TO authenticated USING ((SELECT private.seven_is_leadership()));
DROP POLICY IF EXISTS hotels_leadership_insert ON public.hotels;
CREATE POLICY hotels_leadership_insert ON public.hotels
 FOR INSERT TO authenticated WITH CHECK ((SELECT private.seven_is_leadership()));
DROP POLICY IF EXISTS hotels_leadership_update ON public.hotels;
CREATE POLICY hotels_leadership_update ON public.hotels
 FOR UPDATE TO authenticated
 USING ((SELECT private.seven_is_leadership()))
 WITH CHECK ((SELECT private.seven_is_leadership()));
REVOKE DELETE ON public.hotels FROM authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hotels TO authenticated;

-- Déclarer les fonctions internes hors de l'API publique.
REVOKE ALL ON FUNCTION private.seven_role_immutable_fields() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.can_access_hotel(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_hotel(uuid) TO authenticated;
COMMIT;