/* Seven Hotels — real room availability, gallery and explicit client choice. */
(function(){
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(v,c)=>{try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency:c||"USD",maximumFractionDigits:2}).format(Number(v));}catch{return String(v)+" "+(c||"");}};
const validURL=value=>{try{const u=new URL(value);return u.protocol==="https:"?u.href:"";}catch{return "";}};
function mediaURL(sb,path){
 const s=String(path||"");
 if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/i.test(s))return "";
 return sb.storage.from("seven-property-media").getPublicUrl(s).data.publicUrl;
}
function gallery(sb,room){
 const images=(Array.isArray(room.photos)?room.photos:[]).slice(0,8).map(p=>mediaURL(sb,p)).filter(Boolean);
 if(!images.length && room.type_image_url){const u=validURL(room.type_image_url);if(u)images.push(u);}
 if(!images.length)return '<div class="seven-room-no-photo">Photo non disponible</div>';
 return '<div class="seven-room-picture"><img class="seven-room-cover" src="'+esc(images[0])+'" alt="Chambre '+esc(room.room_number)+' – photo principale" loading="lazy"></div>'+(images.length>1?'<div class="seven-room-thumbs">'+images.slice(1,5).map((u,i)=>'<img src="'+esc(u)+'" loading="lazy" alt="Autre vue de la chambre '+esc(room.room_number)+'"></img>').join("")+'</div>':"");
}
function card(sb,room,buttonText,selected){
 return '<article class="seven-select-room'+(selected?' is-selected':'')+'" data-room-card="'+esc(room.room_id)+'"><div class="seven-room-images">'+gallery(sb,room)+'</div><div class="seven-select-room-copy"><span class="seven-room-kicker">CHAMBRE '+esc(room.room_number)+'</span><h3>'+esc(room.room_type_name||"Chambre")+'</h3><p>'+esc(room.room_description||room.type_description||"Séjournez dans cette chambre Seven.")+'</p><div class="seven-room-facts"><span>Jusqu’à '+esc(room.capacity)+' personne(s)</span><strong>'+esc(money(room.nightly_price,room.currency))+' / nuit</strong></div><button type="button" class="seven-room-select-btn" data-select-room="'+esc(room.room_id)+'">'+esc(buttonText||"Choisir cette chambre")+'</button></div></article>';
}
function create({sb,container,getFilters,onChange}){
 if(!container)throw Error("Room-picker container missing");
 let rooms=[],selectedId="",filtersKey="",serial=0,loading=false;
 const parameters=()=>{
  const p=getFilters()||{};
  const hotel=String(p.slug||"").trim(),start=String(p.start||""),end=String(p.end||""),guests=Number(p.guests);
  if(!hotel||!start||!end||end<=start||guests<1||guests>20||!Number.isInteger(guests))return null;
  return {p_hotel_slug:hotel,p_check_in:start,p_check_out:end,p_guests:guests};
 };
 function render(){
  container.innerHTML=!rooms.length?'<p class="seven-inventory-empty">Aucune chambre disponible pour ces dates. Modifiez les dates ou contactez directement l’établissement.</p>':
    '<div class="seven-room-choice-grid">'+rooms.map(r=>card(sb,r,"Choisir cette chambre",r.room_id===selectedId)).join("")+'</div>';
  container.querySelectorAll("[data-select-room]").forEach(b=>b.addEventListener("click",()=>{
   selectedId=b.dataset.selectRoom;
   render();
   if(typeof onChange==="function")onChange(selectedRoom());
  }));
 }
 function reset(message){
  serial++;rooms=[];selectedId="";filtersKey="";loading=false;
  container.innerHTML='<p class="seven-inventory-empty">'+esc(message||"Choisissez vos dates et le nombre de personnes pour voir les chambres disponibles.")+'</p>';
  if(typeof onChange==="function")onChange(null);
 }
 async function refresh({preserveSelection=true}={}){
  if(!sb){reset("Le service de réservation est momentanément indisponible.");return false;}
  const args=parameters();
  if(!args){reset();return false;}
  const key=JSON.stringify(args),old=preserveSelection&&key===filtersKey?selectedId:"",id=++serial;
  selectedId="";rooms=[];loading=true;
  container.innerHTML='<p class="seven-inventory-empty">Recherche des chambres disponibles…</p>';
  try{
   const result=await sb.rpc("seven_public_room_inventory",args);
   if(id!==serial)return false;
   if(result.error)throw result.error;
   const data=Array.isArray(result.data)?result.data:[];
   rooms=data.filter(x=>x&&typeof x.room_id==="string");
   filtersKey=key;
   if(old&&rooms.some(r=>r.room_id===old))selectedId=old;
   loading=false;render();
   if(typeof onChange==="function")onChange(selectedRoom());
   return true;
  }catch(err){
   if(id!==serial)return false;
   console.error("Seven availability failed",err);
   reset("Disponibilités momentanément indisponibles. Réessayez ou contactez l’établissement.");
   return false;
  }
 }
 function selectedRoom(){return !loading?rooms.find(r=>r.room_id===selectedId)||null:null;}
 function choose(id){
  if(!rooms.some(r=>r.room_id===id))return false;
  selectedId=id;render();if(typeof onChange==="function")onChange(selectedRoom());return true;
 }
 return {refresh,reset,choose,selectedRoom,rooms:()=>rooms.slice(),renderCards:(buttonText="Réserver cette chambre")=>rooms.map(r=>card(sb,r,buttonText,false)).join("")};
}
window.SevenRoomPicker={create};
})();