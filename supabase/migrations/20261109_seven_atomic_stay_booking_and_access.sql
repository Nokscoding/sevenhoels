-- SEVEN / 2026-11-09 : réservation atomique, inventaire et contrôle des accès.
-- Aucune suppression d'hôtels, chambres, collaborateurs ou réservations existants.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- Bloquer les chevauchements, y compris en cas de requêtes simultanées.
-- L'intervalle [arrivée, départ) autorise un départ et une arrivée le même jour.
ALTER TABLE public.reservations
  ADD CONSTRAINT seven_reservations_no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (status IN ('pending', 'confirmed', 'checked_in'));

CREATE UNIQUE INDEX IF NOT EXISTS seven_rooms_hotel_number_unique
  ON public.rooms(hotel_id, number);

ALTER TABLE public.seven_booking_requests
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decline_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS seven_booking_request_reservation_unique
  ON public.seven_booking_requests(reservation_id) WHERE reservation_id IS NOT NULL;

-- Les demandes de séjour ne sont approuvées que lorsqu'une vraie réservation existe.
ALTER TABLE public.seven_booking_requests
  ADD CONSTRAINT seven_stay_requires_allocation
  CHECK (NOT (kind = 'stay' AND status = 'approved' AND reservation_id IS NULL));

-- L'interface ne peut plus changer librement 'status' en approved.
REVOKE UPDATE(status) ON public.seven_booking_requests FROM anon, authenticated;
DROP POLICY IF EXISTS seven_requests_staff_update ON public.seven_booking_requests;

-- Les employés d'entretien ne lisent pas les informations personnelles des voyageurs.
DROP POLICY IF EXISTS seven_requests_staff_read ON public.seven_booking_requests;
CREATE POLICY seven_requests_staff_read ON public.seven_booking_requests
  FOR SELECT TO authenticated
  USING (private.seven_has_role(hotel_id, ARRAY['director','manager','reception']));

DROP POLICY IF EXISTS seven_legacy_reservations_select ON public.reservations;
CREATE POLICY seven_stays_authorized_select ON public.reservations
  FOR SELECT TO authenticated
  USING (private.seven_has_role(hotel_id, ARRAY['director','manager','reception','accountant']));

-- Les gérants et directeurs administrent leurs chambres et leurs catégories.
DROP POLICY IF EXISTS seven_room_types_local_insert ON public.room_types;
CREATE POLICY seven_room_types_local_insert ON public.room_types
  FOR INSERT TO authenticated
  WITH CHECK (private.seven_has_role(hotel_id, ARRAY['director','manager']));
DROP POLICY IF EXISTS seven_room_types_local_update ON public.room_types;
CREATE POLICY seven_room_types_local_update ON public.room_types
  FOR UPDATE TO authenticated
  USING (private.seven_has_role(hotel_id, ARRAY['director','manager']))
  WITH CHECK (private.seven_has_role(hotel_id, ARRAY['director','manager']));
DROP POLICY IF EXISTS seven_room_types_local_delete ON public.room_types;
CREATE POLICY seven_room_types_local_delete ON public.room_types
  FOR DELETE TO authenticated
  USING (private.seven_has_role(hotel_id, ARRAY['director','manager']));

DROP POLICY IF EXISTS seven_rooms_local_insert ON public.rooms;
CREATE POLICY seven_rooms_local_insert ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    private.seven_has_role(hotel_id, ARRAY['director','manager']) AND
    EXISTS (SELECT 1 FROM public.room_types t
            WHERE t.id = room_type_id AND t.hotel_id = hotel_id)
  );

-- Contrôle métier, en complément des règles RLS : seuls l'état et les notes
-- peuvent être changés par le personnel local. L'occupation réelle vient du check-in.
CREATE OR REPLACE FUNCTION public.enforce_room_update_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF public.current_profile_role() = 'manager'
     AND public.current_profile_hotel() = OLD.hotel_id
     OR private.seven_has_role(OLD.hotel_id, ARRAY['director','manager','reception','housekeeping'])
  THEN
    IF NEW.hotel_id IS DISTINCT FROM OLD.hotel_id
       OR NEW.room_type_id IS DISTINCT FROM OLD.room_type_id
       OR NEW.number IS DISTINCT FROM OLD.number
       OR NEW.floor IS DISTINCT FROM OLD.floor
       OR NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'room_structure_change_requires_authorization';
    END IF;

    -- Marquer une chambre occupée sans séjour enregistré est interdit.
    IF NEW.operational_status = 'occupied'
       AND OLD.operational_status IS DISTINCT FROM 'occupied'
       AND NOT EXISTS (
         SELECT 1 FROM public.reservations rv
         WHERE rv.room_id=OLD.id AND rv.status='checked_in'
           AND rv.check_in <= CURRENT_DATE AND rv.check_out > CURRENT_DATE
       ) THEN
      RAISE EXCEPTION 'check_in_required';
    END IF;

    -- Une chambre avec client présent ne redevient jamais disponible manuellement.
    IF NEW.operational_status = 'available'
       AND OLD.operational_status IS DISTINCT FROM 'available'
       AND EXISTS (
         SELECT 1 FROM public.reservations rv
         WHERE rv.room_id=OLD.id AND rv.status='checked_in'
       ) THEN
      RAISE EXCEPTION 'guest_still_checked_in';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not_authorized';
END;
$$;

-- Fonction interne non exposée par PostgREST. Le wrapper public utilise
-- SECURITY INVOKER et n'est accessible qu'aux utilisateurs authentifiés.
CREATE OR REPLACE FUNCTION private.seven_accept_request_internal(
  p_request_id uuid, p_room_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  req public.seven_booking_requests%ROWTYPE;
  rm public.rooms%ROWTYPE;
  rt public.room_types%ROWTYPE;
  stay public.reservations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO req
  FROM public.seven_booking_requests
  WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;

  IF NOT private.seven_has_role(req.hotel_id, ARRAY['director','manager','reception']) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF req.kind <> 'stay' THEN RAISE EXCEPTION 'room_required_for_stay_only'; END IF;

  -- Rejouer exactement la même confirmation ne crée jamais une autre réservation.
  IF req.status='approved' AND req.reservation_id IS NOT NULL THEN
    SELECT * INTO stay FROM public.reservations WHERE id=req.reservation_id;
    RETURN jsonb_build_object('reservation_id',stay.id,'reference',stay.reference,
                              'status',stay.status,'already_processed',true);
  END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'request_not_pending'; END IF;
  IF req.start_date < CURRENT_DATE OR req.end_date <= req.start_date THEN
    RAISE EXCEPTION 'invalid_stay_dates';
  END IF;

  SELECT * INTO rm FROM public.rooms
  WHERE id=p_room_id AND hotel_id=req.hotel_id AND active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found_in_hotel'; END IF;

  SELECT * INTO rt FROM public.room_types
  WHERE id=rm.room_type_id AND hotel_id=req.hotel_id AND active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_type_inactive'; END IF;
  IF req.guests < 1 OR req.guests > rt.capacity THEN
    RAISE EXCEPTION 'capacity_exceeded';
  END IF;
  IF rm.operational_status IN ('maintenance','out_of_service') THEN
    RAISE EXCEPTION 'room_out_of_service';
  END IF;
  IF req.start_date=CURRENT_DATE
     AND rm.operational_status IN ('occupied','cleaning') THEN
    RAISE EXCEPTION 'room_not_ready_today';
  END IF;

  -- Le trigger historique valide les liens et le verrou par chambre ;
  -- la contrainte GiST rejette de manière atomique tout chevauchement.
  INSERT INTO public.reservations (
    hotel_id,room_id,room_type_id,guest_name,guest_phone,guest_email,
    guests,check_in,check_out,nightly_price,currency,status,
    payment_status,source,notes,created_by
  ) VALUES (
    req.hotel_id,rm.id,rt.id,req.guest_name,req.guest_phone,req.guest_email,
    req.guests,req.start_date,req.end_date,rt.base_price,rt.currency,
    'confirmed','unpaid','admin',req.notes,auth.uid()
  )
  RETURNING * INTO stay;

  UPDATE public.seven_booking_requests
  SET status='approved',reservation_id=stay.id,
      processed_at=now(),processed_by=auth.uid(),updated_at=now()
  WHERE id=req.id;

  RETURN jsonb_build_object('reservation_id',stay.id,'reference',stay.reference,
                            'status',stay.status,'already_processed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.seven_accept_booking_request(
  p_request_id uuid, p_room_id uuid
)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT private.seven_accept_request_internal($1,$2); $$;

CREATE OR REPLACE FUNCTION private.seven_decline_request_internal(
  p_request_id uuid, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE req public.seven_booking_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO req FROM public.seven_booking_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF NOT private.seven_has_role(req.hotel_id,ARRAY['director','manager','reception']) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'request_not_pending'; END IF;

  UPDATE public.seven_booking_requests
  SET status='declined',decline_reason=left(nullif(btrim(p_reason),''),500),
      processed_at=now(),processed_by=auth.uid(),updated_at=now()
  WHERE id=req.id;
  RETURN jsonb_build_object('request_id',req.id,'status','declined');
END;
$$;

CREATE OR REPLACE FUNCTION public.seven_decline_booking_request(
  p_request_id uuid,p_reason text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT private.seven_decline_request_internal($1,$2); $$;

CREATE OR REPLACE FUNCTION private.seven_transition_stay_internal(
  p_reservation_id uuid,p_action text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE stay public.reservations%ROWTYPE;
        rm public.rooms%ROWTYPE;
        next_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO stay FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation_not_found'; END IF;
  IF NOT private.seven_has_role(stay.hotel_id,ARRAY['director','manager','reception']) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_action='check_in' THEN
    IF stay.status<>'confirmed' THEN RAISE EXCEPTION 'not_confirmed'; END IF;
    IF CURRENT_DATE < stay.check_in OR CURRENT_DATE >= stay.check_out THEN
      RAISE EXCEPTION 'outside_stay_dates';
    END IF;
    SELECT * INTO rm FROM public.rooms WHERE id=stay.room_id FOR UPDATE;
    IF rm.operational_status <> 'available' THEN
      RAISE EXCEPTION 'room_not_ready';
    END IF;
    next_status='checked_in';
  ELSIF p_action='check_out' THEN
    IF stay.status<>'checked_in' THEN RAISE EXCEPTION 'not_checked_in'; END IF;
    next_status='checked_out';
  ELSIF p_action='cancel' THEN
    IF stay.status NOT IN ('pending','confirmed') THEN
      RAISE EXCEPTION 'cannot_cancel_active_stay';
    END IF;
    next_status='cancelled';
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;

  UPDATE public.reservations
  SET status=next_status
  WHERE id=stay.id;

  IF next_status='cancelled' THEN
    UPDATE public.seven_booking_requests
    SET status='cancelled',updated_at=now()
    WHERE reservation_id=stay.id AND status='approved';
  END IF;

  RETURN jsonb_build_object('reservation_id',stay.id,
                            'reference',stay.reference,'status',next_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.seven_transition_stay(
  p_reservation_id uuid,p_action text
)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT private.seven_transition_stay_internal($1,$2); $$;

-- Pas d'exécution anonyme ni de publication des fonctions internes.
REVOKE ALL ON FUNCTION private.seven_accept_request_internal(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.seven_decline_request_internal(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.seven_transition_stay_internal(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.seven_accept_request_internal(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.seven_decline_request_internal(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.seven_transition_stay_internal(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.seven_accept_booking_request(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.seven_decline_booking_request(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.seven_transition_stay(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seven_accept_booking_request(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seven_decline_booking_request(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seven_transition_stay(uuid,text) TO authenticated;

COMMENT ON FUNCTION public.seven_accept_booking_request(uuid,uuid)
IS 'Confirme une demande de séjour ET bloque atomiquement les dates de la chambre choisie.';
COMMENT ON FUNCTION public.seven_transition_stay(uuid,text)
IS 'Transitions contrôlées confirmed -> checked_in -> checked_out (ou annulation autorisée).';
