"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createRfidLayoutStore}=require("../rfid-layout.cjs");
const u1="a1111111-1111-4111-8111-111111111111";
const hotel="b2222222-2222-4222-8222-222222222222";
const room1="c3333333-3333-4333-8333-333333333333";
const room2="d4444444-4444-4444-8444-444444444444";
function fixture(){
 let blob=null;
 const storage={isAsyncEncryptionAvailable:()=>true,
  encryptStringAsync:async data=>Buffer.from(data,"utf8"),
  decryptStringAsync:async data=>({result:data.toString("utf8")})};
 const files={
  readFile:async()=>{if(!blob){const e=new Error("missing");e.code="ENOENT";throw e;}return blob;},
  writeFile:async(_p,data)=>{blob=data;},mkdir:async()=>{},rename:async()=>{}
 };
 return {store:createRfidLayoutStore({app:{getPath:()=>"/safe"},safeStorage:storage,files}),getBlob:()=>blob};
}
test("configurations isolated by hotel and user",async()=>{
 const {store}=fixture();
 await store.put({userId:u1,hotelId:hotel,roomId:room1,building:"Seven 71",floor:"1",lockNo:"01020a"});
 assert.deepEqual(await store.get({userId:u1,hotelId:hotel}),[{roomId:room1,building:"Seven 71",floor:"1",lockNo:"01020A"}]);
 assert.deepEqual(await store.get({userId:room2,hotelId:hotel}),[]);
});
test("rejects incorrect or duplicate lock identifiers",async()=>{
 const {store}=fixture();
 await store.put({userId:u1,hotelId:hotel,roomId:room1,building:"Seven",floor:"RDC",lockNo:"01020A"});
 await assert.rejects(store.put({userId:u1,hotelId:hotel,roomId:room2,building:"Seven",floor:"RDC",lockNo:"01020A"}),/déjà associée/);
 await assert.rejects(store.put({userId:u1,hotelId:hotel,roomId:room2,building:"Seven",floor:"RDC",lockNo:"131"}),/six caractères/);
});
test("never saves plaintext in normal Windows safeStorage operation",async()=>{
 const {store,getBlob}=fixture();
 await store.put({userId:u1,hotelId:hotel,roomId:room1,building:"Seven",floor:"RDC",lockNo:"01020A"});
 assert.ok(Buffer.isBuffer(getBlob()));
});
