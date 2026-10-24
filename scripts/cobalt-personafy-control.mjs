import {pathToFileURL} from 'node:url';
const root='C:/Users/barri/Documents/ChatGPT/Persona Phi/src/media/';
const {createCobaltRetriever}=await import(pathToFileURL(root+'cobalt.ts').href);
const {publicFetch}=await import(pathToFileURL(root+'public-fetch.ts').href);
try {const got=await createCobaltRetriever(new URL('http://127.0.0.1:9100/')).retrieve('https://www.instagram.com/p/De2y_j8AHd1/',{fetch:publicFetch,caps:{image:83886080,video:83886080}});console.log(JSON.stringify({control:'Personafy actual adapter, read-only import',success:true,bytes:got.file.bytes.length}));}catch(e){console.log(JSON.stringify({control:'Personafy actual adapter, read-only import',success:false,reason:e.reason,message:e.message}));}
