-- Seven Hotels & Apartments • Étape 1 • 2026-11-09
-- Migration additive : aucun effacement des tables existantes.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE IF NOT EXISTS public.seven_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('supervisor','director','manager','reception','housekeeping','accountant')),
 full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 160),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT seven_roles_scope CHECK ((role='supervisor' AND hotel_id IS NULL) OR (role<>'supervisor' AND hotel_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS seven_roles_user_hotel_unique ON public.seven_roles(user_id,coalesce(hotel_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS seven_roles_hotel_active_idx ON public.seven_roles(hotel_id,active);

CREATE OR REPLACE FUNCTION private.seven_is_supervisor() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
 AS $$ SELECT EXISTS(SELECT 1 FROM public.seven_roles r WHERE r.user_id=auth.uid() AND r.role='supervisor' AND r.active=true); $$;
CREATE OR REPLACE FUNCTION private.seven_can_access(p_hotel_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
 AS $$ SELECT EXISTS(SELECT 1 FROM public.seven_roles r WHERE r.user_id=auth.uid() AND r.active=true AND (r.role='supervisor' OR r.hotel_id=p_hotel_id)); $$;
CREATE OR REPLACE FUNCTION private.seven_has_role(p_hotel_id uuid,p_roles text[]) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
 AS $$ SELECT EXISTS(SELECT 1 FROM public.seven_roles r WHERE r.user_id=auth.uid() AND r.active=true AND (r.role='supervisor' OR (r.hotel_id=p_hotel_id AND r.role=ANY(p_roles)))); $$;
REVOKE EXECUTE ON FUNCTION private.seven_is_supervisor() FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION private.seven_can_access(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION private.seven_has_role(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.seven_is_supervisor() TO authenticated;
GRANT EXECUTE ON FUNCTION private.seven_can_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.seven_has_role(uuid,text[]) TO authenticated;

ALTER TABLE public.seven_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seven_roles_read ON public.seven_roles;
CREATE POLICY seven_roles_read ON public.seven_roles FOR SELECT TO authenticated USING (user_id=auth.uid() OR (SELECT private.seven_is_supervisor()));
DROP POLICY IF EXISTS seven_roles_create ON public.seven_roles;
CREATE POLICY seven_roles_create ON public.seven_roles FOR INSERT TO authenticated WITH CHECK ((SELECT private.seven_is_supervisor()));
DROP POLICY IF EXISTS seven_roles_update ON public.seven_roles;
CREATE POLICY seven_roles_update ON public.seven_roles FOR UPDATE TO authenticated USING ((SELECT private.seven_is_supervisor())) WITH CHECK ((SELECT private.seven_is_supervisor()));
DROP POLICY IF EXISTS seven_roles_delete ON public.seven_roles;
CREATE POLICY seven_roles_delete ON public.seven_roles FOR DELETE TO authenticated USING ((SELECT private.seven_is_supervisor()));
REVOKE ALL ON public.seven_roles FROM anon,authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seven_roles TO authenticated;

CREATE TABLE IF NOT EXISTS public.seven_booking_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN ('stay','apartment','restaurant','event','fitness')),
 guest_name text NOT NULL CHECK (length(btrim(guest_name)) BETWEEN 2 AND 120),
 guest_phone text NOT NULL CHECK (length(btrim(guest_phone)) BETWEEN 7 AND 30),
 guest_email text CHECK (guest_email IS NULL OR length(guest_email)<=200),
 guests integer NOT NULL DEFAULT 1 CHECK (guests BETWEEN 1 AND 1000),
 start_date date NOT NULL,
 end_date date,
 start_time time,
 notes text CHECK (notes IS NULL OR length(notes)<=1200),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT seven_booking_dates CHECK ((kind IN ('stay','apartment') AND end_date>start_date) OR (kind NOT IN ('stay','apartment') AND end_date IS NULL))
);
CREATE INDEX IF NOT EXISTS seven_requests_hotel_created_idx ON public.seven_booking_requests(hotel_id,created_at DESC);
CREATE INDEX IF NOT EXISTS seven_requests_status_idx ON public.seven_booking_requests(status,created_at DESC);
ALTER TABLE public.seven_booking_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seven_requests_guest_create ON public.seven_booking_requests;
CREATE POLICY seven_requests_guest_create ON public.seven_booking_requests FOR INSERT TO anon,authenticated WITH CHECK (status='pending' AND start_date>=CURRENT_DATE AND EXISTS(SELECT 1 FROM public.hotels h WHERE h.id=hotel_id AND h.active));
DROP POLICY IF EXISTS seven_requests_staff_read ON public.seven_booking_requests;
CREATE POLICY seven_requests_staff_read ON public.seven_booking_requests FOR SELECT TO authenticated USING (private.seven_can_access(hotel_id));
DROP POLICY IF EXISTS seven_requests_staff_update ON public.seven_booking_requests;
CREATE POLICY seven_requests_staff_update ON public.seven_booking_requests FOR UPDATE TO authenticated USING (private.seven_has_role(hotel_id,ARRAY['director','manager','reception'])) WITH CHECK (private.seven_has_role(hotel_id,ARRAY['director','manager','reception']));
REVOKE ALL ON public.seven_booking_requests FROM anon,authenticated;
GRANT INSERT(hotel_id,kind,guest_name,guest_phone,guest_email,guests,start_date,end_date,start_time,notes) ON public.seven_booking_requests TO anon,authenticated;
GRANT SELECT ON public.seven_booking_requests TO authenticated;
GRANT UPDATE(status) ON public.seven_booking_requests TO authenticated;

CREATE TABLE IF NOT EXISTS public.seven_service_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('restaurant','event','fitness')),
 name text NOT NULL,
 capacity integer NOT NULL CHECK (capacity>0),
 description text,
 active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seven_resources_property_idx ON public.seven_service_resources(hotel_id,kind);
ALTER TABLE public.seven_service_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seven_resources_public_select ON public.seven_service_resources;
CREATE POLICY seven_resources_public_select ON public.seven_service_resources FOR SELECT TO anon,authenticated USING (active=true OR private.seven_can_access(hotel_id));
DROP POLICY IF EXISTS seven_resources_staff_write ON public.seven_service_resources;
CREATE POLICY seven_resources_staff_write ON public.seven_service_resources FOR ALL TO authenticated USING (private.seven_has_role(hotel_id,ARRAY['director','manager'])) WITH CHECK (private.seven_has_role(hotel_id,ARRAY['director','manager']));
REVOKE ALL ON public.seven_service_resources FROM anon,authenticated;
GRANT SELECT ON public.seven_service_resources TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.seven_service_resources TO authenticated;

CREATE TABLE IF NOT EXISTS public.seven_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
 clock_in timestamptz NOT NULL DEFAULT now(),
 clock_out timestamptz,
 CONSTRAINT seven_shift_dates CHECK (clock_out IS NULL OR clock_out>clock_in)
);
CREATE INDEX IF NOT EXISTS seven_attendance_user_idx ON public.seven_attendance(user_id,clock_in DESC);
ALTER TABLE public.seven_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seven_attendance_read ON public.seven_attendance;
CREATE POLICY seven_attendance_read ON public.seven_attendance FOR SELECT TO authenticated USING (user_id=auth.uid() OR private.seven_has_role(hotel_id,ARRAY['director','manager']));
DROP POLICY IF EXISTS seven_attendance_insert ON public.seven_attendance;
CREATE POLICY seven_attendance_insert ON public.seven_attendance FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND clock_out IS NULL AND private.seven_can_access(hotel_id));
DROP POLICY IF EXISTS seven_attendance_update ON public.seven_attendance;
CREATE POLICY seven_attendance_update ON public.seven_attendance FOR UPDATE TO authenticated USING (user_id=auth.uid() AND private.seven_can_access(hotel_id)) WITH CHECK (user_id=auth.uid() AND private.seven_can_access(hotel_id));
REVOKE ALL ON public.seven_attendance FROM anon,authenticated;
GRANT SELECT,INSERT ON public.seven_attendance TO authenticated;
GRANT UPDATE(clock_out) ON public.seven_attendance TO authenticated;

CREATE TABLE IF NOT EXISTS public.seven_rfid_cards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
 room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
 card_uid_hash text NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz,
 revoked_at timestamptz,
 created_by uuid REFERENCES auth.users(id),
 CONSTRAINT seven_rfid_hash_not_raw CHECK (length(card_uid_hash)>=32)
);
ALTER TABLE public.seven_rfid_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seven_rfid_manage ON public.seven_rfid_cards;
CREATE POLICY seven_rfid_manage ON public.seven_rfid_cards FOR ALL TO authenticated USING (private.seven_has_role(hotel_id,ARRAY['director','manager','reception'])) WITH CHECK (private.seven_has_role(hotel_id,ARRAY['director','manager','reception']));
REVOKE ALL ON public.seven_rfid_cards FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.seven_rfid_cards TO authenticated;

-- Accès aux anciennes tables, en complément des politiques existantes.
DROP POLICY IF EXISTS seven_rooms_select ON public.rooms;
CREATE POLICY seven_rooms_select ON public.rooms FOR SELECT TO authenticated USING (private.seven_can_access(hotel_id));
DROP POLICY IF EXISTS seven_rooms_update ON public.rooms;
CREATE POLICY seven_rooms_update ON public.rooms FOR UPDATE TO authenticated USING (private.seven_has_role(hotel_id,ARRAY['director','manager','reception','housekeeping'])) WITH CHECK (private.seven_has_role(hotel_id,ARRAY['director','manager','reception','housekeeping']));
DROP POLICY IF EXISTS seven_room_types_select ON public.room_types;
CREATE POLICY seven_room_types_select ON public.room_types FOR SELECT TO authenticated USING (private.seven_can_access(hotel_id));
DROP POLICY IF EXISTS seven_legacy_reservations_select ON public.reservations;
CREATE POLICY seven_legacy_reservations_select ON public.reservations FOR SELECT TO authenticated USING (private.seven_can_access(hotel_id));
DROP POLICY IF EXISTS seven_payments_select ON public.payments;
CREATE POLICY seven_payments_select ON public.payments FOR SELECT TO authenticated USING (private.seven_has_role(hotel_id,ARRAY['director','manager','accountant']));
-- Données minimales connues ; adresses, prix, photos réelles et chambres seront ajoutés par la direction.
INSERT INTO public.hotels(slug,name,city,active) VALUES
('seven-7','Seven 7','À préciser',true),
('seven-47','Seven 47','À préciser',true),
('seven-71','Seven 71','À préciser',true),
('seven-apartments','Seven Apartments','À préciser',true)
ON CONFLICT (slug) DO NOTHING;
COMMIT;
