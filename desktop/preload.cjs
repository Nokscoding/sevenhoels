"use strict";
const {contextBridge,ipcRenderer}=require("electron");

contextBridge.exposeInMainWorld("sevenDesktop",Object.freeze({
 platform:"windows",
 saveSnapshot:data=>ipcRenderer.invoke("seven:cache-save",data),
 readSnapshot:()=>ipcRenderer.invoke("seven:cache-read"),
 clearSnapshot:()=>ipcRenderer.invoke("seven:cache-clear"),
 getVersion:()=>ipcRenderer.invoke("seven:app-version"),
 getUpdateState:()=>ipcRenderer.invoke("seven:update-state"),
 checkForUpdates:()=>ipcRenderer.invoke("seven:update-check"),
 downloadUpdate:()=>ipcRenderer.invoke("seven:update-download"),
 installUpdate:()=>ipcRenderer.invoke("seven:update-install"),
 onUpdateStatus:callback=>{
  if(typeof callback!=="function")return ()=>{};
  const listener=(_event,status)=>callback(status);
  ipcRenderer.on("seven:update-status",listener);
  return ()=>ipcRenderer.removeListener("seven:update-status",listener);
 }
}));
