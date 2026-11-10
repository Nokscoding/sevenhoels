-- SQL already applied to the connected Seven Supabase project.
-- Keep this file as reproducible versioned source. Public endpoints deliberately expose only
-- active rooms whose categories are published and which have actual room photos.
CREATE OR REPLACE FUNCTION public.notify_reservation_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_title text; v_body text; v_roles text[]; v_link text := '#stays';
BEGIN
 IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
   RETURN NEW;
 END IF;
 IF NEW.status='pending' AND NEW.source='public' THEN
   v_title:='Nouvelle réservation en ligne';
   v_body:='La réservation '||NEW.reference||' attend la confirmation de l’équipe. Chambre déjà bloquée.';
   v_roles:=ARRAY['director','manager','reception'];
   v_link:='#requests';
 ELSIF NEW.status='confirmed' THEN
   v_title:='Réservation confirmée';
   v_body:='Le séjour '||NEW.reference||' est confirmé. Chambre attribuée.';
   v_roles:=ARRAY['director','manager','reception'];
 ELSIF NEW.status='checked_in' THEN
   v_title:='Arrivée enregistrée';
   v_body:='Check-in effectué pour le séjour '||NEW.reference||'.';
   v_roles:=ARRAY['director','manager','reception','housekeeping'];
 ELSIF NEW.status='checked_out' THEN
   v_title:='Chambre à nettoyer';
   v_body:='Le séjour '||NEW.reference||' est terminé. Préparer la chambre.';
   v_roles:=ARRAY['director','manager','reception','housekeeping'];
 ELSIF NEW.status='cancelled' THEN
   v_title:='Séjour annulé';
   v_body:='La réservation '||NEW.reference||' est annulée.';
   v_roles:=ARRAY['director','manager','reception'];
 ELSE
   RETURN NEW;
 END IF;
 PERFORM private.seven_notify_roles(NEW.hotel_id,v_roles,v_title,v_body,'reservation',v_link);
 RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seven_public_room_inventory(p_hotel_slug text, p_check_in date, p_check_out date, p_guests integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF p_hotel_slug IS NULL OR length(p_hotel_slug)>90 OR p_check_in IS NULL OR p_check_out IS NULL
   OR p_check_in < CURRENT_DATE OR p_check_out <= p_check_in
   OR p_check_out > p_check_in + 90 OR p_guests NOT BETWEEN 1 AND 20
 THEN RAISE EXCEPTION 'invalid_search' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.nightly_price, q.room_number),'[]'::jsonb) INTO result
 FROM (
   SELECT r.id AS room_id, r.number AS room_number, r.description AS room_description,
          rt.id AS room_type_id, rt.name AS room_type_name,
          rt.description AS type_description, rt.capacity, rt.base_price AS nightly_price,
          rt.currency, rt.image_url AS type_image_url,
          coalesce((SELECT jsonb_agg(m.storage_path ORDER BY m.is_cover DESC,m.sort_order,m.created_at)
             FROM public.seven_media m
             WHERE m.hotel_id=r.hotel_id AND m.room_id=r.id AND m.kind='room'),'[]'::jsonb) AS photos
   FROM public.rooms r
   JOIN public.room_types rt ON rt.id=r.room_type_id AND rt.hotel_id=r.hotel_id
   JOIN public.hotels h ON h.id=r.hotel_id
   WHERE h.slug=p_hotel_slug AND h.active AND r.active AND rt.active AND rt.website_published
     AND rt.capacity>=p_guests
     AND r.operational_status NOT IN ('maintenance','out_of_service')
     AND NOT (p_check_in=CURRENT_DATE AND r.operational_status IN ('occupied','cleaning'))
     AND EXISTS (SELECT 1 FROM public.seven_media m
                 WHERE m.hotel_id=r.hotel_id AND m.room_id=r.id AND m.kind='room')
     AND NOT EXISTS (
       SELECT 1 FROM public.reservations v
       WHERE v.room_id=r.id AND v.status IN ('pending','confirmed','checked_in')
         AND daterange(v.check_in,v.check_out,'[)') && daterange(p_check_in,p_check_out,'[)')
     )
 ) q;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.seven_reserve_selected_room(p_room_id uuid, p_check_in date, p_check_out date, p_guest_name text, p_guest_phone text, p_guest_email text, p_guests integer, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.reservations%ROWTYPE; b record;
BEGIN
 IF p_room_id IS NULL OR p_check_in IS NULL OR p_check_out IS NULL
    OR p_check_out<=p_check_in OR p_check_in<CURRENT_DATE
    OR p_check_out>p_check_in+90 OR p_guests NOT BETWEEN 1 AND 20
    OR length(coalesce(p_guest_name,'')) NOT BETWEEN 2 AND 120
    OR length(coalesce(p_guest_phone,'')) NOT BETWEEN 7 AND 30
    OR length(coalesce(p_guest_email,''))>200 OR length(coalesce(p_notes,''))>1200
 THEN RAISE EXCEPTION 'invalid_reservation' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.rooms r
   JOIN public.room_types rt ON rt.id=r.room_type_id AND rt.hotel_id=r.hotel_id
   JOIN public.hotels h ON h.id=r.hotel_id
   WHERE r.id=p_room_id AND r.active AND rt.active AND rt.website_published
     AND h.active AND rt.capacity>=p_guests
     AND r.operational_status NOT IN ('maintenance','out_of_service')
     AND NOT (p_check_in=CURRENT_DATE AND r.operational_status IN ('occupied','cleaning'))
     AND EXISTS (SELECT 1 FROM public.seven_media m
                 WHERE m.room_id=r.id AND m.hotel_id=r.hotel_id AND m.kind='room')
 ) THEN RAISE EXCEPTION 'room_unavailable' USING ERRCODE='P0001'; END IF;
 SELECT * INTO b FROM public.create_public_reservation(
   p_room_id,p_check_in,p_check_out,trim(p_guest_name),trim(p_guest_phone),
   nullif(trim(coalesce(p_guest_email,'')),''),p_guests,nullif(trim(coalesce(p_notes,'')),'')
 );
 RETURN jsonb_build_object('reservation_id',b.reservation_id,'reference',b.reference,
                           'total_amount',b.total_amount,'currency',b.currency,'status',b.status);
END $function$;

-- Disable legacy public endpoints that allowed unpublished rooms to be queried/booked.
REVOKE ALL ON FUNCTION public.create_public_reservation(uuid,date,date,text,text,text,integer,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_available_rooms(text,date,date,integer) FROM PUBLIC, anon, authenticated;
