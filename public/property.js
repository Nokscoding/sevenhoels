(function(){"use strict";
const cfg=window.SEVEN_CONFIG||{},p=window.SEVEN_PROPERTY||{},sb=(cfg.url&&cfg.publishableKey&&window.supabase)?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let hotelId=null;
function photo(url){try{const u=new URL(url);return u.protocol==="https:"?u.href:"";}catch{return "";}}
async function load(){if(!sb)return;const r=await sb.from("hotels").select("id,name,slug,active").eq("slug",p.dbSlug).eq("active",true).maybeSingle();if(r.error||!r.data)return;hotelId=r.data.id;
 const rooms=await sb.from("room_types").select("name,description,capacity,base_price,currency,image_url").eq("hotel_id",hotelId).eq("active",true).eq("website_published",true).order("base_price");
 if(!rooms.error&&rooms.data?.length){$("roomsGrid").innerHTML=rooms.data.map((room,i)=>{const src=photo(room.image_url)||p.roomImages[i%p.roomImages.length];const price=Number(room.base_price)>0?new Intl.NumberFormat("fr-FR",{style:"currency",currency:room.currency||"USD"}).format(room.base_price):"Sur demande";
return '<article class="room-card"><img loading="lazy" src="'+esc(src)+'" alt="'+esc(room.name)+'"><div class="room-content"><span class="label">HÉBERGEMENT</span><h3>'+esc(room.name)+'</h3><p>'+esc(room.description||"Découvrez cette catégorie d’hébergement auprès de notre équipe.")+'</p><div class="room-foot"><small>Jusqu’à '+esc(room.capacity)+' personne(s) · '+esc(price)+'</small><button type="button" data-book="stay">Demander ↗</button></div></div></article>';}).join("");$("roomNotice").textContent="Photos et informations publiées par l'établissement, sous réserve de disponibilité et de confirmation.";}
}
let kind="stay";
function setKind(v){kind=v;$("bookingKind").value=v;const stay=v==="stay";$("endWrap").hidden=!stay;$("endDate").required=stay;$("timeWrap").hidden=stay;$("modalTitle").textContent=stay?"Préparer votre séjour":v==="restaurant"?"Demander une table":v==="event"?"Votre événement":"Votre séance";}
function openModal(v){setKind(v||"stay");$("formMessage").textContent="";$("bookingDialog").showModal();}
document.addEventListener("click",e=>{const btn=e.target.closest("[data-book]");if(btn)openModal(btn.dataset.book);});
$("closeDialog").addEventListener("click",()=> $("bookingDialog").close());
$("bookingDialog").addEventListener("click",e=>{if(e.target===$("bookingDialog"))$("bookingDialog").close();});
const today=new Date(),now=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
$("startDate").min=now;$("endDate").min=now;$("startDate").addEventListener("change",e=>{const d=e.target.value;$("endDate").min=d;if($("endDate").value&&$("endDate").value<=d)$("endDate").value="";});
$("bookingForm").addEventListener("submit",async e=>{e.preventDefault();const data=new FormData(e.target),msg=$("formMessage"),submit=$("sendBooking");msg.textContent="";msg.className="";
if(data.get("website"))return;
if(!sb||!hotelId){msg.className="error";msg.textContent="Le service de réservation est momentanément indisponible.";return;}
const start=String(data.get("start_date")),end=String(data.get("end_date")||"");
if(kind==="stay"&&(!end||end<=start)){msg.textContent="La date de départ doit suivre celle d'arrivée.";msg.className="error";return;}
const payload={hotel_id:hotelId,kind,guest_name:String(data.get("guest_name")||"").trim(),guest_phone:String(data.get("guest_phone")||"").trim(),guest_email:String(data.get("guest_email")||"").trim()||null,guests:Number(data.get("guests")),start_date:start,end_date:kind==="stay"?end:null,start_time:kind==="stay"?null:String(data.get("start_time")||"")||null,notes:String(data.get("notes")||"").trim()||null};
submit.disabled=true;submit.textContent="Envoi…";try{const r=await sb.from("seven_booking_requests").insert(payload);if(r.error)throw r.error;msg.textContent="Votre demande a été transmise. La réservation sera confirmée après vérification par l'établissement.";msg.className="success";e.target.reset();}catch(err){console.error(err);msg.textContent="Impossible de transmettre la demande pour le moment. Veuillez réessayer.";msg.className="error";}finally{submit.disabled=false;submit.textContent="Envoyer ma demande ↗";}});
load().catch(e=>console.error(e));
})();