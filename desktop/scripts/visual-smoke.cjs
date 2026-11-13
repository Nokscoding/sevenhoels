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

  // Exercise the desktop RFID entry point with a fake bridge; never start native tools in QA.
  const rfid=await win.webContents.executeJavaScript(
   '(async function(){'+
   'window.__rfidLaunches=0;window.sevenDesktop={getRfidStudioStatus:async()=>({supported:true,available:true,version:"2.2",servicePort:10086}),openRfidStudio:async()=>{window.__rfidLaunches++;return {ok:true}},openRfidCardLock:async()=>({ok:true})};'+
   'await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="./rfid-studio-ui.js";script.onload=resolve;script.onerror=()=>reject(Error("RFID entry point not loadable"));document.body.append(script)});'+
   'await new Promise(resolve=>setTimeout(resolve,50));'+
   'document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="rfidPage"));'+
   'const panel=document.getElementById("sevenRfidStudioPanel"),button=document.getElementById("sevenRfidStudioOpen");'+
   'if(!panel||!button||button.disabled)throw Error("Bundled RFID studio entry point unavailable");'+
   'button.click();await new Promise(resolve=>setTimeout(resolve,20));'+
   'return {launches:window.__rfidLaunches,visible:panel.getBoundingClientRect().height>100,label:button.textContent,warning:panel.textContent.includes("CardLock"),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};})()',true
  );
  assert.equal(rfid.launches,1,"RFID button must invoke only the dedicated bridge");
  assert.equal(rfid.visible,true,"RFID compatibility panel must be visible");
  assert.equal(rfid.warning,true,"CardLock dependency must be visible to reception");
  assert.ok(rfid.overflow<=3,"RFID panel must not overflow the desktop");
  await fs.writeFile(path.join(output,"Seven-Gestion-RFID-Compat.png"),(await win.webContents.capturePage()).toPNG());
  console.log("Seven RFID compatibility UI validated:",JSON.stringify(rfid));

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
