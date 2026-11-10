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
