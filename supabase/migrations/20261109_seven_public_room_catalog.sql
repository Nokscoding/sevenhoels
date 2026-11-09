-- Seven / catalogue public des catégories de chambres.
-- Une chambre ne devient visible sur le site public qu'après publication volontaire.
ALTER TABLE public.room_types
ADD COLUMN IF NOT EXISTS website_published boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS seven_room_types_published_anon ON public.room_types;
CREATE POLICY seven_room_types_published_anon
 ON public.room_types FOR SELECT TO anon
 USING (
   active = true
   AND website_published = true
   AND EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.active = true)
 );
GRANT SELECT (id,hotel_id,name,description,capacity,base_price,currency,image_url,active,website_published) ON public.room_types TO anon;
COMMENT ON COLUMN public.room_types.website_published IS 'Publication volontaire de la catégorie sur les pages publiques Seven ; false par défaut.';