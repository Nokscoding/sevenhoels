-- Directors are global operational leaders, so they receive alerts from
-- every hotel just like moderators. Local staff alerts remain scoped.
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
   AND (role.role IN ('supervisor','director') OR
       (role.hotel_id=p_hotel_id AND role.role=ANY(p_local_roles)));
END;
$fn$;
REVOKE ALL ON FUNCTION private.seven_notify_roles(uuid,text[],text,text,text,text)
 FROM PUBLIC,anon,authenticated;