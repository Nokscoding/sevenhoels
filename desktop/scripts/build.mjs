import {build} from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const current=path.dirname(fileURLToPath(import.meta.url));
const desktop=path.resolve(current,"..");
const root=path.resolve(desktop,"..");
// Release builds checkout the separately managed administrator repository.
 // Locally, the mirrored erp/ files are used as a fallback.
const source=process.env.SEVEN_ADMIN_SOURCE_DIR
 ?path.resolve(process.env.SEVEN_ADMIN_SOURCE_DIR):path.join(root,"erp");
const dist=path.join(desktop,"renderer");

await fs.rm(dist,{recursive:true,force:true});
await fs.mkdir(path.join(dist,"vendor"),{recursive:true});

for(const filename of ["index.html","app.js","notifications.js","config.js","style.css","management.css","ui-polish.css","interface-contrast.css","sidebar-mobile.css"]){
 await fs.copyFile(path.join(source,filename),path.join(dist,filename));
}
await fs.cp(path.join(source,"assets"),path.join(dist,"assets"),{recursive:true});
await fs.copyFile(path.join(desktop,"offline.js"),path.join(dist,"offline.js"));
await fs.copyFile(path.join(desktop,"offline.css"),path.join(dist,"offline.css"));
await fs.copyFile(path.join(desktop,"update-ui.js"),path.join(dist,"update-ui.js"));
await fs.copyFile(path.join(desktop,"update-ui.css"),path.join(dist,"update-ui.css"));

let html=await fs.readFile(path.join(dist,"index.html"),"utf8");
const cdn='<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js" defer></script>';
if(!html.includes(cdn))throw Error("Supabase CDN tag not found; update the desktop build script");
html=html.replace(cdn,'<script src="./vendor/supabase.js" defer></script>');
html=html.replace('<script src="./app.js" defer></script>',
 '<script src="./offline.js" defer></script><script src="./update-ui.js" defer></script><script src="./app.js" defer></script>');
html=html.replace('<link rel="stylesheet" href="./management.css">',
 '<link rel="stylesheet" href="./management.css"><link rel="stylesheet" href="./offline.css"><link rel="stylesheet" href="./update-ui.css">');
const csp=[
 "default-src 'self'",
 "script-src 'self'",
 "style-src 'self' 'unsafe-inline'",
 "img-src 'self' data: https://images.unsplash.com https://ylhdlaunnyqrpceeyaki.supabase.co",
 "font-src 'self'",
 "connect-src 'self' https://ylhdlaunnyqrpceeyaki.supabase.co wss://ylhdlaunnyqrpceeyaki.supabase.co",
 "object-src 'none'",
 "frame-src 'none'",
 "base-uri 'none'",
 "form-action 'self'"
].join("; ");
html=html.replace("<head>","<head><meta http-equiv=\"Content-Security-Policy\" content=\""+csp+"\">");
await fs.writeFile(path.join(dist,"index.html"),html);

let css=await fs.readFile(path.join(dist,"style.css"),"utf8");
// The desktop app must render offline, without waiting for Google Fonts.
css=css.replace(/^@import\s+url\(['"]https:\/\/fonts\.googleapis\.com\/[^;]+;/,"");
await fs.writeFile(path.join(dist,"style.css"),css);

await build({
 entryPoints:[path.join(desktop,"vendor-entry.js")],
 outfile:path.join(dist,"vendor","supabase.js"),
 bundle:true,format:"iife",platform:"browser",target:["chrome156"],
 minify:true,legalComments:"none",logLevel:"warning"
});
console.log("Seven Windows renderer generated. Includes web ERP, manager area and local Supabase bundle.");
