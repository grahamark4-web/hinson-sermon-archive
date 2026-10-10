import archive from './archive-audio.json';
import {searchTranscripts} from './transcript_search.mjs';
const allowed=new Map(Object.values(archive.byDate).map(e=>[new URL(e.url).pathname.split('/').pop(),e.url]));
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/transcript-search'){if(request.method!=='GET')return new Response('Method not allowed',{status:405});return searchTranscripts(request,env);}
  const download=url.pathname.startsWith('/download/');
  if(!download&&!url.pathname.startsWith('/archive-audio/'))return env.ASSETS.fetch(request);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  let filename=url.pathname.slice('/archive-audio/'.length),source=allowed.get(filename);
  if(download){
   const catalogResponse=await env.ASSETS.fetch(new Request(new URL('/sermons.json',url)));
   const catalog=await catalogResponse.json();
   const sermon=catalog.sermons.find(s=>s.id===decodeURIComponent(url.pathname.slice('/download/'.length)));
   if(!sermon||!sermon.audio)return new Response('Recording not found',{status:404});
   source=sermon.audio.startsWith('/archive-audio/')?allowed.get(sermon.audio.split('/').pop()):sermon.audio;
   if(!source||!/^https:\/\//.test(source)&&!source.startsWith('http://www.hinsonchurch.net/audio/'))return new Response('Recording not found',{status:404});
   filename=(sermon.date+'-'+sermon.title).normalize('NFKD').replace(/[^a-zA-Z0-9 -]/g,'').trim().replace(/ +/g,'-').slice(0,140)+'.mp3';
  }
  if(!source)return new Response('Recording not found',{status:404});
  const headers=new Headers();
  for(const key of ['Range','If-Range','If-None-Match','If-Modified-Since'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
  let upstream;
  try{upstream=await fetch(source,{method:request.method,headers,redirect:'manual'});}catch(error){return new Response('Recording temporarily unavailable',{status:502,headers:{'X-Audio-Upstream-Status':'fetch-error','X-Audio-Error':String(error.message).replace(/[^a-zA-Z0-9 .:-]/g,'').slice(0,150)}});}
  if(![200,206,304,416].includes(upstream.status))return new Response('Recording temporarily unavailable',{status:502,headers:{'X-Audio-Upstream-Status':String(upstream.status)}});
  const out=new Headers();
  for(const key of ['Content-Length','Content-Range','Accept-Ranges','ETag','Last-Modified'])if(upstream.headers.has(key))out.set(key,upstream.headers.get(key));
  if(download)out.set('Content-Disposition','attachment; filename="'+filename+'"');
  out.set('Content-Type','audio/mpeg');out.set('Cache-Control','public, max-age=14400');out.set('X-Content-Type-Options','nosniff');
  return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:out});
 }
};
