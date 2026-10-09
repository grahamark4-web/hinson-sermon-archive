import archive from './archive-audio.json';
const allowed=new Map(Object.values(archive.byDate).map(e=>[new URL(e.url).pathname.split('/').pop(),e.url]));
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/archive-audio/'))return env.ASSETS.fetch(request);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const filename=url.pathname.slice('/archive-audio/'.length),source=allowed.get(filename);
  if(!source)return new Response('Recording not found',{status:404});
  const headers=new Headers();
  for(const key of ['Range','If-Range','If-None-Match','If-Modified-Since'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
  let upstream;
  try{upstream=await fetch(source,{method:request.method,headers,redirect:'manual'});}catch(error){return new Response('Recording temporarily unavailable',{status:502,headers:{'X-Audio-Upstream-Status':'fetch-error','X-Audio-Error':String(error.message).replace(/[^a-zA-Z0-9 .:-]/g,'').slice(0,150)}});}
  if(![200,206,304,416].includes(upstream.status))return new Response('Recording temporarily unavailable',{status:502,headers:{'X-Audio-Upstream-Status':String(upstream.status)}});
  const out=new Headers();
  for(const key of ['Content-Length','Content-Range','Accept-Ranges','ETag','Last-Modified'])if(upstream.headers.has(key))out.set(key,upstream.headers.get(key));
  out.set('Content-Type','audio/mpeg');out.set('Cache-Control','public, max-age=14400');out.set('X-Content-Type-Options','nosniff');
  return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:out});
 }
};
