/* Seven Hotels — accessible feedback + restrained scroll interactions */
(function(){
 "use strict";
 function modal(){
  let dialog=document.getElementById("reservationFeedbackDialog");
  if(dialog)return dialog;
  dialog=document.createElement("dialog");
  dialog.id="reservationFeedbackDialog";
  dialog.className="reservation-feedback";
  dialog.setAttribute("aria-labelledby","feedbackTitle");
  dialog.setAttribute("aria-describedby","feedbackText");
  dialog.innerHTML='<div class="feedback-inner"><div class="feedback-symbol" aria-hidden="true">✓</div><p class="feedback-eyebrow">SEVEN · RÉSERVATIONS</p><h2 id="feedbackTitle"></h2><p id="feedbackText"></p><button type="button" class="feedback-close">Compris, merci</button></div>';
  document.body.append(dialog);
  dialog.querySelector(".feedback-close").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
  return dialog;
 }
 function show(ok,message){
  const dialog=modal();
  dialog.dataset.result=ok?"success":"error";
  dialog.querySelector(".feedback-symbol").textContent=ok?"✓":"!";
  dialog.querySelector("#feedbackTitle").textContent=ok?"Votre réservation a été enregistrée":"Votre réservation n’a pas été enregistrée";
  dialog.querySelector("#feedbackText").textContent=message||(ok?
    "Notre équipe va vous contacter au numéro ou à l’adresse indiqués pour vérifier les disponibilités et confirmer les détails. Aucun paiement n’a été prélevé.":
    "Un problème est survenu. Vérifiez votre connexion et réessayez. Aucun paiement n’a été prélevé.");
  if(!dialog.open)dialog.showModal();
 }
 window.SevenReservationFeedback={show};
 function animate(){
  if(!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const obs=new IntersectionObserver(entries=>{for(const item of entries){
    if(item.isIntersecting){item.target.classList.add("is-inview");obs.unobserve(item.target);}
  }},{threshold:.08,rootMargin:"0px 0px -20px 0px"});
  const watch=root=>{const nodes=root.querySelectorAll(".property-card,.room-card,.section-heading,.intro-copy,.experience,.gallery,.contact,.statement,.hotel-hero .hero-content");
   nodes.forEach((node,i)=>{if(node.dataset.revealObserved)return;node.dataset.revealObserved="1";node.classList.add("reveal-on-scroll");node.style.setProperty("--reveal-delay",(i%4*65)+"ms");obs.observe(node);});};
  watch(document);
  const grids=["propertyGrid","roomsGrid"];
  if("MutationObserver" in window){for(const id of grids){const parent=document.getElementById(id);if(parent)new MutationObserver(()=>watch(parent)).observe(parent,{childList:true,subtree:true});}}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",animate,{once:true});else animate();
})();
