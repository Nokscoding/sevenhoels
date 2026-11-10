(function(){
"use strict";
var cfg=window.SEVEN_CONFIG||{},client=null;
if(cfg.url&&cfg.publishableKey&&window.supabase){client=window.supabase.createClient(cfg.url,cfg.publishableKey);}
var fallback=[
 {id:"",slug:"seven-7",name:"Seven 7",type:"HÔTEL",desc:"Un séjour à votre rythme.",img:"photo-1566073771259-6a8506099945"},
 {id:"",slug:"seven-47",name:"Seven 47",type:"HÔTEL",desc:"L'élégance au quotidien.",img:"photo-1611892440504-42a792e24d32"},
 {id:"",slug:"seven-71",name:"Seven 71",type:"HÔTEL",desc:"Votre adresse pour une parenthèse.",img:"photo-1551882547-ff40c63fe5fa"},
 {id:"",slug:"seven-apartments",name:"Seven Apartments",type:"APPARTEMENTS",desc:"Le confort comme à la maison.",img:"photo-1600607687939-ce8a6c25118c"}
];
var properties=fallback.slice(),currentKind="stay";
function byId(id){return document.getElementById(id);}
function escapeText(s){return String(s||"").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function imageUrl(id,w){return "https://images.unsplash.com/"+id+"?auto=format&fit=crop&w="+w+"&q=82";}
function render(){
 var routes={"seven-7":"./hotels/7/","seven-47":"./hotels/47/","seven-71":"./hotels/71/","seven-apartments":"./appartements/"};
 byId("propertyGrid").innerHTML=properties.map(function(p){
  var link=routes[p.slug]||"#etablissements";
  var soon=p.slug==="seven-apartments";
  return '<article class="property-card"><a class="property-media-link" href="'+link+'"><div class="property-media"><img loading="lazy" src="'+imageUrl(p.img,800)+'" alt="Photographie d’ambiance pour '+escapeText(p.name)+'"><span class="property-tag">'+(soon?'COMING SOON':escapeText(p.type))+'</span></div></a><div class="property-body"><h3><a href="'+link+'">'+escapeText(p.name)+'</a></h3><p>'+escapeText(soon?'Un nouvel art de séjourner, prochainement.':p.desc)+'</p><a class="property-card-cta" href="'+link+'">'+(soon?'Découvrir bientôt ':"Découvrir l'hôtel ")+'</a></div></article>';
 }).join("");
 var options=properties.filter(function(p){return p.slug!=="seven-apartments";}).map(function(p){return '<option value="'+escapeText(p.id)+'" '+(!p.id?'disabled':'')+'>'+escapeText(p.name)+'</option>';}).join("");
 byId("hotelSelect").innerHTML='<option value="">Sélectionner un établissement</option>'+options;
}

var roomPicker=window.SevenRoomPicker.create({
 sb:client,container:byId("availableRoomsPicker"),
 getFilters:function(){
  var h=properties.find(function(p){return p.id===byId("hotelSelect").value;});
  var slugs={"seven-7":"seven7","seven-47":"47","seven-71":"71"};
  return {slug:h?slugs[h.slug]||h.slug:"",start:byId("startDate").value,end:byId("endDate").value,guests:Number(byId("bookingForm").elements.guests.value)};
 },
 onChange:function(room){byId("selectedRoomLabel").textContent=room?"Chambre "+room.room_number+" sélectionnée · "+room.room_type_name:"Sélectionnez une chambre parmi les disponibilités.";}
});
function searchRooms(){return currentKind==="stay"?roomPicker.refresh():Promise.resolve(false);}
function setKind(kind){currentKind=kind;byId("kindSelect").value=kind;byId("selectedRoomWrap").hidden=kind!=="stay";byId("bookingForm").elements.guests.max=kind==="stay"?"20":"1000";var stay=kind==="stay"||kind==="apartment";byId("endDateWrap").hidden=!stay;byId("endDate").required=stay;byId("timeWrap").hidden=stay;document.querySelectorAll("[data-quick]").forEach(function(b){b.classList.toggle("active",b.dataset.quick===kind);});}
function openBooking(kind,slug){setKind(kind||"stay");var hotel=properties.find(function(p){return p.slug===slug;});if(hotel)byId("hotelSelect").value=hotel.id;byId("bookingMessage").textContent="";byId("bookingMessage").className="";byId("bookingDialog").showModal();searchRooms();}
document.querySelectorAll("[data-book]").forEach(function(b){b.addEventListener("click",function(){openBooking(b.dataset.book);});});
document.querySelectorAll("[data-quick]").forEach(function(b){b.addEventListener("click",function(){setKind(b.dataset.quick);});});
byId("quickBook").addEventListener("click",function(){openBooking(currentKind);});
byId("propertyGrid").addEventListener("click",function(e){var b=e.target.closest("[data-property]");if(b)openBooking(b.dataset.property==="seven-apartments"?"apartment":"stay",b.dataset.property);});
byId("closeDialog").addEventListener("click",function(){byId("bookingDialog").close();});
byId("bookingDialog").addEventListener("click",function(e){if(e.target===this)this.close();});
byId("kindSelect").addEventListener("change",function(){setKind(this.value);searchRooms();});
byId("hotelSelect").addEventListener("change",searchRooms);
byId("endDate").addEventListener("change",searchRooms);
byId("bookingForm").elements.guests.addEventListener("change",searchRooms);
byId("menuButton").addEventListener("click",function(){var n=byId("nav");n.classList.toggle("open");this.setAttribute("aria-expanded",n.classList.contains("open")?"true":"false");});
document.querySelectorAll(".nav a").forEach(function(a){a.addEventListener("click",function(){byId("nav").classList.remove("open");});});
var today=new Date();today.setHours(0,0,0,0);var iso=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
byId("startDate").min=iso;byId("endDate").min=iso;byId("startDate").addEventListener("change",function(){byId("endDate").min=this.value;if(byId("endDate").value&&byId("endDate").value<=this.value)byId("endDate").value="";searchRooms();});
byId("bookingForm").addEventListener("submit",async function(e){e.preventDefault();var msg=byId("bookingMessage"),btn=byId("submitBooking"),form=new FormData(this);msg.textContent="";msg.className="";if(form.get("website"))return;if(!client){msg.textContent="Le service de réservation est momentanément indisponible.";msg.className="error";window.SevenReservationFeedback?.show(false);return;}
var kind=String(form.get("kind")),start=String(form.get("start_date")),end=String(form.get("end_date")||""),hid=String(form.get("hotel_id"));if(!hid){msg.textContent="Choisissez un établissement.";msg.className="error";window.SevenReservationFeedback?.show(false,"Veuillez choisir un établissement avant de continuer.");return;}
if((kind==="stay"||kind==="apartment")&&(!end||end<=start)){msg.textContent="La date de départ doit être postérieure à l'arrivée.";msg.className="error";window.SevenReservationFeedback?.show(false,msg.textContent);return;}
var payload={hotel_id:hid,kind:kind,guest_name:String(form.get("guest_name")||"").trim(),guest_phone:String(form.get("guest_phone")||"").trim(),guest_email:String(form.get("guest_email")||"").trim()||null,guests:Number(form.get("guests")),start_date:start,end_date:(kind==="stay"||kind==="apartment")?end:null,start_time:(kind==="stay"||kind==="apartment")?null:String(form.get("start_time")||"")||null,notes:String(form.get("notes")||"").trim()||null};

btn.disabled=true;btn.textContent="Envoi en cours…";
try{
 var reference="";
 if(kind==="stay"){
  var selected=roomPicker.selectedRoom();
  if(!selected){msg.textContent="Choisissez une chambre disponible.";msg.className="error";return;}
  var fresh=await roomPicker.refresh({preserveSelection:true});
  if(!fresh||!roomPicker.selectedRoom()||roomPicker.selectedRoom().room_id!==selected.room_id)throw Error("room_unavailable");
  var result=await client.rpc("seven_reserve_selected_room",{
   p_room_id:selected.room_id,p_check_in:start,p_check_out:end,
   p_guest_name:payload.guest_name,p_guest_phone:payload.guest_phone,p_guest_email:payload.guest_email,
   p_guests:payload.guests,p_notes:payload.notes
  });
  if(result.error)throw result.error;
  reference=result.data?.reference||"";
 }else{
  var response=await client.from("seven_booking_requests").insert(payload);
  if(response.error)throw response.error;
 }
 this.reset();roomPicker.reset();msg.textContent="Réservation enregistrée — confirmation après contact de notre équipe.";msg.className="success";
 byId("bookingDialog").close();
 window.SevenReservationFeedback?.show(true,"Votre réservation "+(reference?"n° "+reference+" ":"")+"a été enregistrée. La chambre choisie est bloquée pour vos dates. Notre équipe vous contactera avant confirmation.");
}catch(err){
 console.error("Seven booking failed",err);
 var unavailable=String(err?.message||"").includes("room_unavailable")||String(err?.code||"")==="23P01";
 msg.textContent=unavailable?"Cette chambre est déjà réservée. Choisissez-en une autre.":"Réservation non enregistrée. Réessayez.";
 msg.className="error";
 window.SevenReservationFeedback?.show(false,unavailable?msg.textContent:window.SevenReservationFeedback?.explainError(err));
 if(kind==="stay")await roomPicker.refresh({preserveSelection:false});
}finally{btn.disabled=false;btn.textContent="Enregistrer ma réservation ";}});
async function loadProperties(){if(!client)return;var r=await client.from("hotels").select("id,slug,name,active").eq("active",true);if(r.error||!r.data)return;properties=fallback.map(function(p){var aliases={"seven-7":["seven7","seven-7"],"seven-47":["47","seven-47"],"seven-71":["71","seven-71"],"seven-apartments":["seven-apartments"]};var h=r.data.find(function(v){return (aliases[p.slug]||[p.slug]).includes(v.slug);});return Object.assign({},p,{id:h?h.id:""});});render();}
render();setKind("stay");loadProperties().catch(function(e){console.error(e);});
})();