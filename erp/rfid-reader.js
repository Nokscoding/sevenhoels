/* Seven RFID S18 — diagnostic local pour lecteurs USB en mode clavier.
   Le diagnostic n'envoie aucun identifiant au serveur. */
(function () {
  "use strict";
  const field=document.getElementById("rfidScanInput");
  const form=document.getElementById("rfidScanForm");
  const page=document.getElementById("rfidPage");
  const button=document.getElementById("rfidReaderTest");
  const output=document.getElementById("rfidReaderTestResult");
  if(!field||!form||!page||!button||!output)return;
  let testing=false,completionTimer=0;
  function stopTimer(){if(completionTimer){clearTimeout(completionTimer);completionTimer=0;}}
  function setMessage(message,state){
    output.textContent=message;
    output.dataset.result=state;
  }
  function endTest(){
    if(!testing)return;
    stopTimer();
    const value=field.value.trim();
    field.value="";
    testing=false;
    button.textContent="Tester le lecteur";
    button.setAttribute("aria-pressed","false");
    if(!value){
      setMessage("Aucun numéro reçu. Vérifiez le branchement USB et essayez aussi dans le Bloc-notes Windows.","error");
    }else if(!/^[a-z0-9]{6,32}$/i.test(value)){
      setMessage("Lecture détectée ("+value.length+" caractères), mais format non pris en charge. Vérifiez le mode clavier, la langue du clavier et les paramètres du lecteur.","error");
    }else{
      setMessage("Lecture détectée : "+value.length+" caractères alphanumériques. Le lecteur transmet un numéro compatible avec le format Seven. Aucune carte n'a été enregistrée.","success");
    }
    if(page.classList.contains("active"))field.focus();
  }
  button.addEventListener("click",()=>{
    if(testing){
      testing=false;stopTimer();field.value="";
      button.textContent="Tester le lecteur";
      button.setAttribute("aria-pressed","false");
      setMessage("Test annulé. Aucun numéro enregistré.","pending");
      return;
    }
    testing=true;field.value="";
    button.textContent="Arrêter le test";
    button.setAttribute("aria-pressed","true");
    setMessage("Test actif. Posez une carte sur le lecteur USB S18 : le numéro ne sera pas envoyé au serveur.","pending");
    field.focus();
  });
  field.addEventListener("input",()=>{
    if(!testing)return;
    stopTimer();
    // Certains lecteurs n'envoient pas Entrée : on clôt le diagnostic après la saisie.
    completionTimer=setTimeout(endTest,750);
  });
  field.addEventListener("keydown",event=>{
    if(!testing)return;
    if(event.key==="Enter"||event.key==="Tab"){
      event.preventDefault();
      event.stopImmediatePropagation();
      endTest();
    }
  },true);
  form.addEventListener("submit",event=>{
    if(!testing)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    endTest();
  },true);
  // Le logiciel Windows sélectionne le champ à l'ouverture du module RFID.
  const observer=new MutationObserver(()=>{
    if(!page.classList.contains("active")){
      if(testing){testing=false;stopTimer();field.value="";button.textContent="Tester le lecteur";button.setAttribute("aria-pressed","false");}
      return;
    }
    if(window.sevenDesktop?.platform==="windows"&&!testing){
      setTimeout(()=>{if(page.classList.contains("active"))field.focus();},0);
    }
  });
  observer.observe(page,{attributes:true,attributeFilter:["class"]});
})();