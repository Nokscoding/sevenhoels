-- Seven Apartments reste Coming soon : aucune demande publique n'est acceptée.
DROP POLICY IF EXISTS seven_requests_guest_create ON public.seven_booking_requests;
CREATE POLICY seven_requests_guest_create
 ON public.seven_booking_requests FOR INSERT TO anon,authenticated
 WITH CHECK (
   status='pending'
   AND kind IN ('stay','restaurant','event','fitness')
   AND start_date >= CURRENT_DATE
   AND EXISTS (
     SELECT 1 FROM public.hotels h
     WHERE h.id=hotel_id AND h.active=true AND h.slug<>'seven-apartments'
   )
 );