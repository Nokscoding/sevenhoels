"use strict";
/* Test the actual Windows Electron layout, including computed CSS. */
const {app,BrowserWindow,protocol,net,session}=require("electron");
const {pathToFileURL}=require("node:url");
const fs=require("node:fs/promises");
const path=require("node:path");
const assert=require("node:assert/strict");
const ROOT=path.resolve(__dirname,"..","renderer");
const output=path.resolve(__dirname,"..","..","release");
app.disableHardwareAcceleration();
protocol.registerSchemesAsPrivileged([{scheme:"seven",privileges:{
 standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true
}}]);
async function run(){
 let win;
 try{
  await app.whenReady();
  protocol.handle("seven",request=>{
   const url=new URL(request.url);
   if(url.host!=="app")return new Response("Forbidden",{status:403});
   const name=decodeURIComponent(url.pathname).replace(/^\/+/,"")||"index.html";
   if(name.includes("\0")||name.split("/").includes(".."))return new Response("Forbidden",{status:403});
   const target=path.resolve(ROOT,name);
   if(!target.startsWith(ROOT+path.sep))return new Response("Forbidden",{status:403});
   return net.fetch(pathToFileURL(target).toString());
  });
  // This is only a styling test; never query live hotel data.
  session.defaultSession.webRequest.onBeforeRequest(
   {urls:["https://*/*","wss://*/*"]},(_details,cb)=>cb({cancel:true})
  );
  win=new BrowserWindow({width:1360,height:900,show:false,
   webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  const pending=win.loadURL("seven://app/index.html");
  await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error("Electron renderer timeout")),25000))]);
  const results=await win.webContents.executeJavaScript(
   '(function(){'+
   'const get=s=>document.querySelector(s),cs=s=>getComputedStyle(get(s));'+
   'const loginDisplay=cs(".login-shell").display,loginColumns=cs(".login-shell").gridTemplateColumns.trim().split(/\\s+/).length;'+
   'const labelDisplay=cs(".login-form label").display;'+
   'get("#loginScreen").hidden=true;get("#appShell").hidden=false;'+
   'const sidebar=get(".sidebar"),workspace=get(".workspace"),main=get(".main"),nav=get(".sidebar .side-link");'+
   'return {bodyMargin:getComputedStyle(document.body).marginLeft,loginDisplay,loginColumns,labelDisplay,'+
   'shellDisplay:cs(".app-shell").display,navDisplay:cs(".sidebar .side-link").display,'+
   'menuHeight:nav.getBoundingClientRect().height,menuWidth:nav.getBoundingClientRect().width,'+
   'sidebarWidth:sidebar.getBoundingClientRect().width,workspaceWidth:workspace.getBoundingClientRect().width,'+
   'mainOffsetX:main.getBoundingClientRect().left,headTop:get(".topbar").getBoundingClientRect().top,'+
   'horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,'+
   'loadedStyles:[...document.styleSheets].map(s=>s.href||"inline")};})()',true
  );
  console.log("Seven Electron computed layout:",JSON.stringify(results));
  assert.equal(results.bodyMargin,"0px","The base stylesheet is not applied");
  assert.equal(results.loginDisplay,"grid","Login layout must be a two-column grid");
  assert.ok(results.loginColumns>=2,"Login grid needs two columns");
  assert.equal(results.labelDisplay,"flex","Login labels must be stacked");
  assert.equal(results.shellDisplay,"flex","App sidebar and workspace must be flex");
  assert.equal(results.navDisplay,"flex","Sidebar buttons must be flex rows");
  assert.ok(results.menuHeight>=35&&results.menuWidth>140,"Module buttons not styled");
  assert.ok(results.sidebarWidth>=200&&results.sidebarWidth<=350,"Sidebar should have constrained width");
  assert.ok(results.workspaceWidth>580,"Workspace is missing");
  assert.ok(results.mainOffsetX>=results.sidebarWidth-2,"Main content overlaps sidebar");
  assert.ok(results.headTop>=0&&results.headTop<120,"Topbar is misplaced");
  assert.ok(results.horizontalOverflow<=3,"The whole app has a horizontal scrollbar");
  await fs.mkdir(output,{recursive:true});
  const img=await win.webContents.capturePage();
  await fs.writeFile(path.join(output,"Seven-Gestion-Desktop-Layout.png"),img.toPNG());

  // Ensure that walk-in check-in is visible in the actual Electron layout.
  const guest=await win.webContents.executeJavaScript(
   '(function(){document.getElementById("loginScreen").hidden=true;'+
   'document.getElementById("appShell").hidden=false;'+
   'document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="receptionPage"));'+
   'const page=document.getElementById("receptionPage"),form=document.getElementById("receptionBookingForm"),'+
   'start=document.getElementById("receptionStartButton");'+
   'if(!page||!form||!start)throw Error("Accueil client manquant");'+
   'document.getElementById("receptionCreationPanel").hidden=false;'+
   'return {formVisible:form.getBoundingClientRect().height>100,'+
   'startVisible:start.getBoundingClientRect().height>25,'+
   'overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};})()',true
  );
  assert.equal(guest.formVisible,true,"Reception client form must be visible");
  assert.equal(guest.startVisible,true,"Reception must prominently show New Client");
  assert.ok(guest.overflow<=3,"Reception page cannot overflow screen");
  await fs.writeFile(path.join(output,"Seven-Gestion-Reception.png"),(await win.webContents.capturePage()).toPNG());

  // Exercise the real inline RFID panel using an entirely fake hardware bridge.
  const rfid=await win.webContents.executeJavaScript(
   '(async function(){'+
   'window.__rfidOps=[];'+
   'const hotel="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",room="cccccccc-cccc-4ccc-8ccc-cccccccccccc",stay="dddddddd-dddd-4ddd-8ddd-dddddddddddd";'+
   'window.SevenRfidContext=()=>({userId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",hotelId:hotel,hotelName:"Seven Test",role:"manager",'+
    'rooms:[{id:room,hotel_id:hotel,number:"131",floor:"1"}],'+
    'stays:[{id:stay,hotel_id:hotel,room_id:room,reference:"TEST",check_in:"2026-11-13",check_out:"2026-11-14",status:"checked_in"}]});'+
   'window.sevenDesktop={'+
    'getRfidRoomLayout:async()=>[{roomId:room,building:"Seven Test",floor:"1",lockNo:"01020A"}],'+
    'saveRfidRoomLayout:async()=>({}),getRfidVendorId:async()=>12345,saveRfidVendorId:async()=>12345,'+
    'getNativeRfidStatus:async()=>({available:true,cardLockReady:true}),'+
    'runNativeRfid:async payload=>{window.__rfidOps.push(payload.operation);return {ok:true,type:"F",sequence:"FFFFFFFF",message:"Carte vierge reconnue"}},'+
    'openRfidCardLock:async()=>({ok:true})};'+
   'await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="./rfid-workflow-ui.js";script.onload=resolve;script.onerror=()=>reject(Error("Inline RFID UI not loadable"));document.body.append(script)});'+
   'await new Promise(resolve=>setTimeout(resolve,130));'+
   'document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="rfidPage"));'+
   'const panel=document.getElementById("sevenRfidWorkflow"),read=document.getElementById("sevenRfidRead"),issue=document.getElementById("sevenRfidIssue");'+
   'if(!panel||!read||!issue||read.disabled)throw Error("Native RFID panel unavailable");'+
   'read.click();await new Promise(resolve=>setTimeout(resolve,65));'+
   'return {operations:window.__rfidOps,visible:panel.getBoundingClientRect().height>100,issuePresent:!!issue,'+
    'warning:panel.textContent.includes("CardLock"),'+
    'separateStudio:panel.textContent.includes("Ouvrir Seven RFID Studio"),'+
    'overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};})()',true
  );
  assert.deepEqual(rfid.operations,["read"],"Reading must invoke the inline native bridge");
  assert.equal(rfid.visible,true,"Native RFID panel must be visible");
  assert.equal(rfid.issuePresent,true,"Native encode button must be present");
  assert.equal(rfid.warning,true,"CardLock dependency must be clearly visible");
  assert.equal(rfid.separateStudio,false,"No separate Studio launch UI");
  assert.ok(rfid.overflow<=3,"Native RFID panel must not overflow the desktop");
  await fs.writeFile(path.join(output,"Seven-Gestion-RFID-Inline.png"),(await win.webContents.capturePage()).toPNG());
  console.log("Seven inline RFID UI validated:",JSON.stringify(rfid));

  // Mount the real production updater UI with a safe fake read-only bridge.
  // Do not send any booking or authentication requests during this test.
  const popup=await win.webContents.executeJavaScript(
    '(async function(){'+
    'document.getElementById("appShell").hidden=true;document.getElementById("loginScreen").hidden=false;'+
    'const mock={phase:"available",currentVersion:"0.2.2",nextVersion:"0.2.3",percent:0,releaseNotes:"Fenêtre de mise à jour et progression améliorées."};'+
    'window.sevenDesktop={getUpdateState:async()=>mock,checkForUpdates:async()=>({ok:true}),downloadUpdate:async()=>({ok:true}),installUpdate:async()=>true,onUpdateStatus:cb=>{window.__testUpdate=cb;return ()=>{}}};'+
    'await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="./update-ui.js";script.onload=resolve;script.onerror=()=>reject(Error("update-ui.js not loadable"));document.body.append(script)});'+
    'await new Promise(resolve=>setTimeout(resolve,80));'+
    'const d=document.getElementById("sevenUpdateDialog");'+
    'if(!d||!d.open)throw Error("Updater modal does not open on login");'+
    'const rect=d.getBoundingClientRect();const overlay={width:rect.width,height:rect.height,open:d.open,title:document.getElementById("sevenUpdateTitle").textContent};'+
    'window.__testUpdate({phase:"downloading",percent:46,transferred:47000000,total:100000000,bytesPerSecond:2700000,remainingSeconds:20});'+
    'const downloading={percent:Number(document.getElementById("sevenUpdateProgress").value),visible:!document.getElementById("sevenUpdateProgressWrap").hidden,rate:document.getElementById("sevenUpdateSpeed").textContent,remaining:document.getElementById("sevenUpdateRemaining").textContent,modalOpen:d.open};'+
    'return {overlay,downloading};})()',true
  );
  assert.ok(popup.overlay.width>=420&&popup.overlay.height>200,"Update popup is too small to notice");
  assert.equal(popup.overlay.open,true,"Available update needs a prominent modal");
  assert.equal(popup.downloading.percent,46,"Real progress percentage not visible");
  assert.equal(popup.downloading.visible,true,"Progress bar must be shown");
  assert.equal(popup.downloading.modalOpen,true,"Progress must stay visible as download starts");
  assert.ok(popup.downloading.rate.includes("Mo/s"),"Download speed missing");
  assert.ok(popup.downloading.remaining.includes("restantes"),"Remaining time missing");
  const progressImage=await win.webContents.capturePage();
  await fs.writeFile(path.join(output,"Seven-Gestion-Update-Progress.png"),progressImage.toPNG());
  const ready=await win.webContents.executeJavaScript(
    '(function(){window.__testUpdate({phase:"ready",percent:100,nextVersion:"0.2.3"});return {title:document.getElementById("sevenUpdateTitle").textContent,button:document.getElementById("sevenUpdatePrimary").textContent,open:document.getElementById("sevenUpdateDialog").open}})()',true
  );
  assert.equal(ready.open,true,"Completed download must show update popup");
  assert.ok(ready.button.includes("Installer et redémarrer"),"Install/restart button missing");
  console.log("Seven Windows update modal validated:",JSON.stringify({popup,ready}));

  console.log("Seven Electron layout OK:",JSON.stringify(results));
  app.exit(0);
 }catch(error){
  console.error("Seven Electron layout failed:",error);
  if(win)try{
   await fs.mkdir(output,{recursive:true});
   const img=await win.webContents.capturePage();
   await fs.writeFile(path.join(output,"Seven-Gestion-Desktop-FAILED.png"),img.toPNG());
  }catch{}
  app.exit(1);
 }
}
run();
