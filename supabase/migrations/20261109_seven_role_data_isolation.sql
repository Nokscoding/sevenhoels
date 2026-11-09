-- Seven Hotels / Isolation métier par rôle — 2026-11-09
-- Les employés de nettoyage ne peuvent pas modifier les paiements ni les
-- réservations et ne peuvent jamais lire les coordonnées des clients.
BEGIN;

DROP POLICY IF EXISTS payments_staff_select ON public.payments;
DROP POLICY IF EXISTS payments_staff_insert ON public.payments;
DROP POLICY IF EXISTS payments_staff_update ON public.payments;
DROP POLICY IF EXISTS seven_payments_select ON public.payments;
CREATE POLICY seven_payments_select ON public.payments
  FOR SELECT TO authenticated
  USING (private.seven_has_role(hotel_id,ARRAY['manager','accountant','reception']));
CREATE POLICY seven_payments_write_insert ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (private.seven_has_role(hotel_id,ARRAY['manager','accountant']));
CREATE POLICY seven_payments_write_update ON public.payments
  FOR UPDATE TO authenticated
  USING (private.seven_has_role(hotel_id,ARRAY['manager','accountant']))
  WITH CHECK (private.seven_has_role(hotel_id,ARRAY['manager','accountant']));

DROP POLICY IF EXISTS reservations_staff_select ON public.reservations;
DROP POLICY IF EXISTS reservations_staff_insert ON public.reservations;
DROP POLICY IF EXISTS reservations_staff_update ON public.reservations;
DROP POLICY IF EXISTS seven_stays_authorized_select ON public.reservations;
CREATE POLICY seven_stays_authorized_select ON public.reservations
 FOR SELECT TO authenticated
 USING (private.seven_has_role(hotel_id,ARRAY['manager','reception','accountant']));
CREATE POLICY seven_stays_staff_insert ON public.reservations
 FOR INSERT TO authenticated
 WITH CHECK (private.seven_has_role(hotel_id,ARRAY['manager','reception']));
CREATE POLICY seven_stays_staff_update ON public.reservations
 FOR UPDATE TO authenticated
 USING (private.seven_has_role(hotel_id,ARRAY['manager','reception']))
 WITH CHECK (private.seven_has_role(hotel_id,ARRAY['manager','reception']));

DROP POLICY IF EXISTS rooms_staff_update ON public.rooms;

DROP POLICY IF EXISTS activity_logs_staff_select ON public.activity_logs;
CREATE POLICY activity_logs_management_select ON public.activity_logs
 FOR SELECT TO authenticated
 USING (hotel_id IS NOT NULL AND private.seven_has_role(hotel_id,ARRAY['manager']));

DROP POLICY IF EXISTS seven_rooms_local_insert ON public.rooms;
CREATE POLICY seven_rooms_local_insert ON public.rooms
 FOR INSERT TO authenticated
 WITH CHECK (
   private.seven_has_role(hotel_id,ARRAY['manager'])
   AND EXISTS(
     SELECT 1 FROM public.room_types t
     WHERE t.id=rooms.room_type_id AND t.hotel_id=rooms.hotel_id
   )
 );

-- Éviter les modifications de statut occupé hors du cycle check-in / check-out,
-- y compris par les directeurs et le modérateur.
CREATE OR REPLACE FUNCTION public.enforce_room_update_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NOT private.seven_has_role(OLD.hotel_id,ARRAY['manager','reception','housekeeping']) THEN
   RAISE EXCEPTION 'not_authorized';
 END IF;

 IF NEW.hotel_id IS DISTINCT FROM OLD.hotel_id THEN
   RAISE EXCEPTION 'hotel_reassignment_not_allowed';
 END IF;

 IF (NEW.room_type_id IS DISTINCT FROM OLD.room_type_id OR
     NEW.number IS DISTINCT FROM OLD.number OR
     NEW.floor IS DISTINCT FROM OLD.floor OR
     NEW.active IS DISTINCT FROM OLD.active)
    AND NOT private.seven_has_role(OLD.hotel_id,ARRAY['manager']) THEN
   RAISE EXCEPTION 'room_structure_change_requires_authorization';
 END IF;

 IF NEW.operational_status='occupied'
    AND OLD.operational_status IS DISTINCT FROM 'occupied'
    AND NOT EXISTS (
      SELECT 1 FROM public.reservations rv
      WHERE rv.room_id=OLD.id AND rv.status='checked_in'
        AND rv.check_in<=CURRENT_DATE AND rv.check_out>CURRENT_DATE
    ) THEN
   RAISE EXCEPTION 'check_in_required';
 END IF;

 IF NEW.operational_status='available'
    AND OLD.operational_status IS DISTINCT FROM 'available'
    AND EXISTS (
      SELECT 1 FROM public.reservations rv
      WHERE rv.room_id=OLD.id AND rv.status='checked_in'
    ) THEN
   RAISE EXCEPTION 'guest_still_checked_in';
 END IF;

 RETURN NEW;
END;
$fn$;

-- Les écritures financières et les réservations ne sont jamais accessibles
-- depuis un compte d'entretien, même si quelqu'un forge une requête HTTP.
-- Les suppressions définitives sont réservées au modérateur et devraient
-- rester exceptionnelles (préférer annulation / remboursement).
DROP POLICY IF EXISTS payments_admin_delete ON public.payments;
CREATE POLICY payments_moderator_delete ON public.payments
 FOR DELETE TO authenticated USING ((SELECT private.seven_is_supervisor()));
DROP POLICY IF EXISTS reservations_admin_delete ON public.reservations;
CREATE POLICY reservations_moderator_delete ON public.reservations
 FOR DELETE TO authenticated USING ((SELECT private.seven_is_supervisor()));

COMMIT;