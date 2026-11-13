-- Seven Gestion / RFID USB reader S18 (keyboard mode if supported).
-- No physical door control: this only associates card identifiers with active stays.
-- A new secret is generated on a fresh installation. Never commit the pepper itself.
CREATE TABLE IF NOT EXISTS private.seven_rfid_secret(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 pepper text NOT NULL
);
REVOKE ALL ON private.seven_rfid_secret FROM PUBLIC,anon,authenticated;
INSERT INTO private.seven_rfid_secret(singleton,pepper)
 VALUES(true,encode(extensions.gen_random_bytes(32),'hex'))
 ON CONFLICT(singleton) DO NOTHING;

ALTER TABLE public.seven_rfid_cards
 ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seven_rfid_one_active_uid
 ON public.seven_rfid_cards(card_uid_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS seven_rfid_reservation_lookup
 ON public.seven_rfid_cards(reservation_id) WHERE revoked_at IS NULL;
ALTER TABLE public.seven_rfid_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seven_rfid_manage ON public.seven_rfid_cards;
DROP POLICY IF EXISTS seven_rfid_local_staff_read ON public.seven_rfid_cards;
CREATE POLICY seven_rfid_local_staff_read ON public.seven_rfid_cards
 FOR SELECT TO authenticated USING(private.seven_has_role(hotel_id,ARRAY['manager','reception']));
REVOKE INSERT,UPDATE,DELETE ON public.seven_rfid_cards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.seven_rfid_cards TO authenticated;

CREATE OR REPLACE FUNCTION private.seven_rfid_hash(p_uid text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE k text; v text:=upper(btrim(coalesce(p_uid,'')));
BEGIN
 IF length(v)<6 OR length(v)>32 OR v !~ '^[0-9A-Z]+$' THEN
  RAISE EXCEPTION 'invalid_card_uid' USING ERRCODE='22023';
 END IF;
 SELECT pepper INTO k FROM private.seven_rfid_secret WHERE singleton=true;
 IF k IS NULL THEN RAISE EXCEPTION 'rfid_configuration_missing'; END IF;
 RETURN encode(extensions.hmac(v,k,'sha256'),'hex');
END;
$function$;

CREATE OR REPLACE FUNCTION public.seven_rfid_issue(p_hotel_id uuid, p_reservation_id uuid, p_uid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE stay public.reservations%ROWTYPE; card_id uuid; h text; expires timestamptz;
BEGIN
 IF auth.uid() IS NULL OR
   NOT private.seven_has_role(p_hotel_id,ARRAY['manager','reception']) THEN
    RAISE EXCEPTION 'not_authorized'; END IF;
 SELECT * INTO stay FROM public.reservations
 WHERE id=p_reservation_id AND hotel_id=p_hotel_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reservation_not_found'; END IF;
 IF stay.status <> 'checked_in' THEN RAISE EXCEPTION 'rfid_checkin_required'; END IF;
 expires:=(stay.check_out::timestamp + interval '11 hours') AT TIME ZONE 'Africa/Lubumbashi';
 IF now()>=expires THEN RAISE EXCEPTION 'rfid_stay_ended'; END IF;
 h:=private.seven_rfid_hash(p_uid);
 -- Reuse a key only once at a time, after explicit revocation.
 IF EXISTS(SELECT 1 FROM public.seven_rfid_cards c
   WHERE c.card_uid_hash=h AND c.revoked_at IS NULL) THEN
   RAISE EXCEPTION 'rfid_card_already_assigned'; END IF;
 INSERT INTO public.seven_rfid_cards
   (hotel_id,room_id,reservation_id,card_uid_hash,issued_at,expires_at,created_by)
 VALUES(p_hotel_id,stay.room_id,stay.id,h,now(),expires,auth.uid())
 RETURNING id INTO card_id;
 RETURN jsonb_build_object('ok',true,'card_id',card_id,'expires_at',expires,
  'room_id',stay.room_id,'reservation_reference',stay.reference);
END;
$function$;

CREATE OR REPLACE FUNCTION public.seven_rfid_revoke(p_hotel_id uuid, p_card_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE item uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.seven_has_role(p_hotel_id,ARRAY['manager','reception']) THEN
    RAISE EXCEPTION 'not_authorized'; END IF;
 UPDATE public.seven_rfid_cards SET revoked_at=now()
 WHERE id=p_card_id AND hotel_id=p_hotel_id AND revoked_at IS NULL
 RETURNING id INTO item;
 IF item IS NULL THEN RAISE EXCEPTION 'rfid_card_not_active'; END IF;
 RETURN jsonb_build_object('ok',true,'card_id',item);
END;
$function$;

CREATE OR REPLACE FUNCTION public.seven_rfid_verify(p_hotel_id uuid, p_uid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE card record; h text; valid_now boolean;
BEGIN
 IF auth.uid() IS NULL OR
   NOT private.seven_has_role(p_hotel_id,ARRAY['manager','reception']) THEN
   RAISE EXCEPTION 'not_authorized'; END IF;
 h:=private.seven_rfid_hash(p_uid);
 SELECT c.id,c.room_id,c.expires_at,c.revoked_at,c.issued_at,
        r.number AS room_number,s.id AS reservation_id,s.reference,s.status,
        s.check_in,s.check_out
 INTO card FROM public.seven_rfid_cards c
 JOIN public.rooms r ON r.id=c.room_id AND r.hotel_id=c.hotel_id
 LEFT JOIN public.reservations s ON s.id=c.reservation_id AND s.hotel_id=c.hotel_id
 WHERE c.card_uid_hash=h AND c.hotel_id=p_hotel_id
 ORDER BY c.issued_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('found',false,'valid',false,'reason','unknown_card'); END IF;
 valid_now:=card.revoked_at IS NULL AND card.expires_at>now() AND card.status='checked_in'
    AND now()>=card.issued_at;
 RETURN jsonb_build_object('found',true,'valid',coalesce(valid_now,false),
   'reason',CASE WHEN card.revoked_at IS NOT NULL THEN 'revoked'
                 WHEN card.expires_at<=now() THEN 'expired'
                 WHEN card.status<>'checked_in' OR card.status IS NULL THEN 'stay_not_active'
                 ELSE 'active' END,
   'room_number',card.room_number,'reference',card.reference,
   'expires_at',card.expires_at,'card_id',card.id);
END;
$function$;


REVOKE ALL ON FUNCTION private.seven_rfid_hash(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.seven_rfid_issue(uuid,uuid,text),
 public.seven_rfid_verify(uuid,text), public.seven_rfid_revoke(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seven_rfid_issue(uuid,uuid,text),
 public.seven_rfid_verify(uuid,text),public.seven_rfid_revoke(uuid,uuid) TO authenticated;
