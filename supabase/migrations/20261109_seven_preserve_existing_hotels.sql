-- Conserver les hôtels historiques, nettoyer uniquement les trois doublons créés par la migration initiale.
DELETE FROM public.hotels h WHERE h.slug IN ('seven-7','seven-47','seven-71')
AND NOT EXISTS(SELECT 1 FROM public.rooms r WHERE r.hotel_id=h.id)
AND NOT EXISTS(SELECT 1 FROM public.reservations r WHERE r.hotel_id=h.id)
AND NOT EXISTS(SELECT 1 FROM public.payments p WHERE p.hotel_id=h.id)
AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.hotel_id=h.id)
AND NOT EXISTS(SELECT 1 FROM public.seven_booking_requests b WHERE b.hotel_id=h.id)
AND NOT EXISTS(SELECT 1 FROM public.seven_roles sr WHERE sr.hotel_id=h.id)
AND NOT EXISTS(SELECT 1 FROM public.seven_service_resources res WHERE res.hotel_id=h.id);
