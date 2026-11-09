-- Seven Hotels · notifications ERP par rôle et par établissement.
-- Les événements publics (demandes) et les événements métiers déclenchent
-- une notification individuelle sécurisée, sans identités clients dans le texte.

-- Les comptes Seven peuvent ne pas posséder de profil dans l'ancien ERP.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS seven_notifications_unread_idx
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS seven_notifications_feed_idx
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_self_select ON public.notifications;
CREATE POLICY notifications_self_select ON public.notifications
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS notifications_self_update ON public.notifications;
CREATE POLICY notifications_self_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id=(SELECT auth.uid()))
  WITH CHECK (user_id=(SELECT auth.uid()));

-- Les utilisateurs ne peuvent modifier ni destinataire, ni contenu, ni hôtel.
REVOKE ALL ON public.notifications FROM anon;
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION private.seven_notify_roles(
  p_hotel_id uuid,p_local_roles text[],
  p_title text,p_body text,p_type text,p_link text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
  INSERT INTO public.notifications(user_id,hotel_id,title,body,type,link)
  SELECT DISTINCT role.user_id,p_hotel_id,p_title,p_body,p_type,p_link
  FROM public.seven_roles role
  WHERE role.active=true
    AND (role.role='supervisor'
      OR (role.hotel_id=p_hotel_id AND role.role=ANY(p_local_roles)));
END;
$fn$;

-- Les alertes sont produites automatiquement par l'insertion d'une demande.
CREATE OR REPLACE FUNCTION private.seven_notify_booking_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_title text;v_body text;
BEGIN
  IF TG_OP<>'INSERT' OR NEW.status<>'pending' THEN RETURN NEW; END IF;
  IF NEW.kind IN ('stay','apartment') THEN
    v_title:='Nouvelle demande de séjour';
    v_body:='Une demande du '||to_char(NEW.start_date,'DD/MM/YYYY')
      ||coalesce(' au '||to_char(NEW.end_date,'DD/MM/YYYY'),'')
      ||' attend une attribution.';
  ELSIF NEW.kind='restaurant' THEN
    v_title:='Nouvelle demande de table';
    v_body:='Une réservation de restaurant a été demandée pour le '
      ||to_char(NEW.start_date,'DD/MM/YYYY')||'.';
  ELSIF NEW.kind='event' THEN
    v_title:='Nouvelle demande événementielle';
    v_body:='Un événement est demandé pour le '
      ||to_char(NEW.start_date,'DD/MM/YYYY')||'.';
  ELSE
    v_title:='Nouvelle demande sport & bien-être';
    v_body:='Une demande de créneau a été reçue.';
  END IF;
  PERFORM private.seven_notify_roles(
    NEW.hotel_id,ARRAY['director','manager','reception'],
    v_title,v_body,'booking_request','#requests'
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS seven_request_notify ON public.seven_booking_requests;
CREATE TRIGGER seven_request_notify
AFTER INSERT ON public.seven_booking_requests
FOR EACH ROW EXECUTE FUNCTION private.seven_notify_booking_request();

-- Remplace l'ancien routage fondé sur profiles.role='admin', trop large.
-- Ce déclencheur existe déjà sur public.reservations.
CREATE OR REPLACE FUNCTION public.notify_reservation_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_title text;v_body text;v_roles text[];
BEGIN
  IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status='confirmed' THEN
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

  PERFORM private.seven_notify_roles(
    NEW.hotel_id,v_roles,v_title,v_body,'reservation','#stays'
  );
  RETURN NEW;
END;
$fn$;

-- L'entretien peut voir qu'une chambre est de nouveau prête.
CREATE OR REPLACE FUNCTION private.seven_notify_room_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_title text;v_body text;
BEGIN
  IF NEW.operational_status IS NOT DISTINCT FROM OLD.operational_status THEN
    RETURN NEW;
  END IF;
  IF NEW.operational_status IN ('maintenance','out_of_service') THEN
    v_title:='Chambre indisponible';
    v_body:='Chambre '||NEW.number||' signalée en maintenance ou hors service.';
  ELSIF OLD.operational_status='cleaning'
     AND NEW.operational_status='available' THEN
    v_title:='Chambre prête';
    v_body:='La chambre '||NEW.number||' est nettoyée et disponible.';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM private.seven_notify_roles(
    NEW.hotel_id,ARRAY['director','manager','reception'],
    v_title,v_body,'room','#rooms'
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS seven_room_notify ON public.rooms;
CREATE TRIGGER seven_room_notify
AFTER UPDATE OF operational_status ON public.rooms
FOR EACH ROW EXECUTE FUNCTION private.seven_notify_room_state();

-- Un utilisateur reçoit une alerte personnelle à l'attribution / réactivation.
CREATE OR REPLACE FUNCTION private.seven_notify_role_granted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
  IF NEW.active AND (TG_OP='INSERT' OR NOT OLD.active) THEN
    INSERT INTO public.notifications(user_id,hotel_id,title,body,type,link)
    VALUES(NEW.user_id,NEW.hotel_id,'Accès Seven activé',
      'Votre accès à l’espace de gestion Seven est disponible.','access','#dashboard');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS seven_role_granted_notify ON public.seven_roles;
CREATE TRIGGER seven_role_granted_notify
AFTER INSERT OR UPDATE OF active ON public.seven_roles
FOR EACH ROW EXECUTE FUNCTION private.seven_notify_role_granted();

-- Les triggers ne doivent pas être exécutables comme des RPC publics.
REVOKE ALL ON FUNCTION private.seven_notify_roles(uuid,text[],text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.seven_notify_booking_request() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.seven_notify_room_state() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.seven_notify_role_granted() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.notify_reservation_event() FROM PUBLIC,anon,authenticated;
