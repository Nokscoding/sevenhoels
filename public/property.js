(function(){"use strict";
const cfg=window.SEVEN_CONFIG||{},p=window.SEVEN_PROPERTY||{},sb=(cfg.url&&cfg.publishableKey&&window.supabase)?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let hotelId=null;
function photo(url){try{const u=new URL(url);return u.protocol==="https:"?u.href:"";}catch{return "";}}
async function load(){if(!sb)return;const r=await sb.from("hotels").select("id,name,slug,active").eq("slug",p.dbSlug).eq("active",true).maybeSingle();if(r.error||!r.data)return;hotelId=r.data.id;

 if(!hotelId)$("roomNotice").textContent="Cet établissement n'est pas encore ouvert à la réservation.";
}
let kind="stay";
const picker=window.SevenRoomPicker.create({
 sb,container:$("availableRoomsPicker"),
 getFilters:()=>({slug:p.dbSlug,start:$("startDate").value,end:$("endDate").value,guests:Number($("bookingForm").elements.guests.value)}),
 onChange:room=>{const msg=$("selectedRoomLabel");msg.textContent=room?"Chambre "+room.room_number+" choisie · "+room.room_type_name:"Sélectionnez une chambre parmi les disponibilités."; }
});
function refreshChoices(){if(kind==="stay")return picker.refresh();picker.reset();}
function searchFromPage(){
 const start=$("publicSearchStart").value,end=$("publicSearchEnd").value,n=Number($("publicSearchGuests").value);
 if(!start||!end||end<=start||!Number.isInteger(n)||n<1||n>20){
  $("roomsGrid").innerHTML='<p class="seven-inventory-empty">Choisissez des dates valides et entre 1 et 20 personnes.</p>';return;
 }
 $("startDate").value=start;$("endDate").value=end;
 $("bookingForm").elements.guests.value=String(n);
 $("roomsGrid").innerHTML='<p class="seven-inventory-empty">Recherche des chambres disponibles…</p>';
 picker.refresh().then(ok=>{
  $("roomsGrid").innerHTML=ok&&picker.rooms().length?'<div class="seven-room-choice-grid">'+picker.renderCards("Réserver cette chambre")+'</div>':'<p class="seven-inventory-empty">Aucune chambre disponible pour ces dates. Essayez une autre période.</p>';
 });
}
$("publicRoomSearch").addEventListener("submit",e=>{e.preventDefault();searchFromPage();});
$("roomsGrid").addEventListener("click",e=>{
 const btn=e.target.closest("[data-select-room]");if(!btn)return;
 const id=btn.dataset.selectRoom;
 openModal("stay");
 picker.refresh({preserveSelection:false}).then(()=>picker.choose(id));
});

function setKind(v){kind=v;$("bookingKind").value=v;const stay=v==="stay";$("endWrap").hidden=!stay;$("endDate").required=stay;$("timeWrap").hidden=stay;$("selectedRoomWrap").hidden=!stay;$("bookingForm").elements.guests.max=stay?"20":"1000";$("modalTitle").textContent=stay?"Choisissez votre chambre":v==="restaurant"?"Réserver une table":v==="event"?"Votre événement":"Votre séance";}
function openModal(v){setKind(v||"stay");$("formMessage").textContent="";$("bookingDialog").showModal();if(kind==="stay")refreshChoices();}
document.addEventListener("click",e=>{const btn=e.target.closest("[data-book]");if(btn)openModal(btn.dataset.book);});
$("closeDialog").addEventListener("click",()=> $("bookingDialog").close());
$("bookingDialog").addEventListener("click",e=>{if(e.target===$("bookingDialog"))$("bookingDialog").close();});
const today=new Date(),now=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
$("startDate").min=now;$("endDate").min=now;$("publicSearchStart").min=now;$("publicSearchEnd").min=now;$("startDate").addEventListener("change",e=>{const d=e.target.value;$("endDate").min=d;if($("endDate").value&&$("endDate").value<=d)$("endDate").value="";refreshChoices();});
$("endDate").addEventListener("change",refreshChoices);
$("bookingForm").elements.guests.addEventListener("change",refreshChoices);
$("publicSearchStart").addEventListener("change",()=>{$("publicSearchEnd").min=$("publicSearchStart").value;});
$("bookingForm").addEventListener("submit",async e=>{e.preventDefault();const data=new FormData(e.target),msg=$("formMessage"),submit=$("sendBooking");msg.textContent="";msg.className="";
if(data.get("website"))return;
if(!sb||!hotelId){msg.className="error";msg.textContent="Le service de réservation est momentanément indisponible.";window.SevenReservationFeedback?.show(false);return;}
const start=String(data.get("start_date")),end=String(data.get("end_date")||"");
if(kind==="stay"&&(!end||end<=start)){msg.textContent="La date de départ doit suivre celle d'arrivée.";msg.className="error";window.SevenReservationFeedback?.show(false,msg.textContent);return;}
const payload={hotel_id:hotelId,kind,guest_name:String(data.get("guest_name")||"").trim(),guest_phone:String(data.get("guest_phone")||"").trim(),guest_email:String(data.get("guest_email")||"").trim()||null,guests:Number(data.get("guests")),start_date:start,end_date:kind==="stay"?end:null,start_time:kind==="stay"?null:String(data.get("start_time")||"")||null,notes:String(data.get("notes")||"").trim()||null};
submit.disabled=true;submit.textContent="Envoi…";
try{
 let reference="";
 if(kind==="stay"){
  const selected=picker.selectedRoom();
  if(!selected){msg.textContent="Choisissez une chambre disponible avant d’enregistrer votre réservation.";msg.className="error";return;}
  const refreshed=await picker.refresh({preserveSelection:true});
  if(!refreshed||!picker.selectedRoom()||picker.selectedRoom().room_id!==selected.room_id)throw Error("room_unavailable");
  const r=await sb.rpc("seven_reserve_selected_room",{
   p_room_id:selected.room_id,p_check_in:start,p_check_out:end,
   p_guest_name:payload.guest_name,p_guest_phone:payload.guest_phone,p_guest_email:payload.guest_email,
   p_guests:payload.guests,p_notes:payload.notes
  });
  if(r.error)throw r.error;reference=r.data?.reference||"";
 }else{
  const r=await sb.from("seven_booking_requests").insert(payload);if(r.error)throw r.error;
 }
 msg.textContent="Réservation enregistrée — notre équipe va vous contacter.";msg.className="success";
 e.target.reset();picker.reset();$("bookingDialog").close();
 window.SevenReservationFeedback?.show(true,"Votre réservation "+(reference?"n° "+reference+" ":"")+"a bien été enregistrée. La chambre choisie est bloquée pour vos dates. Notre équipe vous contactera pour confirmer. Aucun paiement n’a été prélevé.");
}catch(err){
 console.error("Seven reservation error",err);
 const unavailable=String(err?.message||"").includes("room_unavailable")||String(err?.code||"")==="23P01";
 msg.textContent=unavailable?"Cette chambre vient d’être réservée. Choisissez-en une autre.":"Réservation non enregistrée. Veuillez réessayer.";
 msg.className="error";
 window.SevenReservationFeedback?.show(false,unavailable?msg.textContent:window.SevenReservationFeedback?.explainError(err));
 if(kind==="stay")await picker.refresh({preserveSelection:false});
}finally{submit.disabled=false;submit.textContent="Enregistrer ma réservation ";}});
load().catch(e=>console.error(e));
})();