-- Réduire l'exposition publique de fonctions privilégiées historiques, sans bloquer la recherche et les réservations publiques existantes.
DO $block$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.proname IN
           ('audit_change','can_access_hotel','create_staff_reservation','current_profile_hotel',
            'current_profile_role','enforce_room_update_permissions','handle_new_auth_user',
            'is_admin','notify_reservation_event','refresh_reservation_payment_status',
            'sync_room_status_from_reservation','validate_reservation')
 LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 END LOOP;
END $block$;