-- Seven : alertes financières destinées aux directions et à la comptabilité.
CREATE OR REPLACE FUNCTION private.seven_notify_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_reference text;v_title text;v_body text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status='paid' THEN
    v_title:='Paiement reçu';
    v_body:='Paiement de '||NEW.amount::text||' '||NEW.currency||' enregistré';
  ELSIF NEW.status='refunded' THEN
    v_title:='Remboursement enregistré';
    v_body:='Remboursement de '||NEW.amount::text||' '||NEW.currency||' enregistré';
  ELSE
    RETURN NEW;
  END IF;
  SELECT reference INTO v_reference FROM public.reservations WHERE id=NEW.reservation_id;
  v_body:=v_body||coalesce(' pour le séjour '||v_reference,'')||'.';
  PERFORM private.seven_notify_roles(
    NEW.hotel_id,ARRAY['director','manager','accountant'],
    v_title,v_body,'payment','#stays'
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS seven_payment_notify ON public.payments;
CREATE TRIGGER seven_payment_notify
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.seven_notify_payment();
REVOKE ALL ON FUNCTION private.seven_notify_payment() FROM PUBLIC,anon,authenticated;