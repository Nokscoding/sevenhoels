"use strict";
const {contextBridge,ipcRenderer}=require("electron");

contextBridge.exposeInMainWorld("sevenDesktop",Object.freeze({
 platform:"windows",
 saveSnapshot:data=>ipcRenderer.invoke("seven:cache-save",data),
 readSnapshot:()=>ipcRenderer.invoke("seven:cache-read"),
 clearSnapshot:()=>ipcRenderer.invoke("seven:cache-clear"),
 getVersion:()=>ipcRenderer.invoke("seven:app-version")
}));
