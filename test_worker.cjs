const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const text=fs.readFileSync('worker.mjs','utf8').replace("import archive from './archive-audio.json';","const archive="+fs.readFileSync('archive-audio.json','utf8')+';');
 const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
 const url='https://app.example/archive-audio/'+new URL(Object.values(JSON.parse(fs.readFileSync('archive-audio.json')).byDate)[0].url).pathname.split('/').pop();
 let upstreamRequest;
 global.fetch=async(source,init)=>{upstreamRequest={source,init};return new Response(new Uint8Array([1,2,3]),{status:206,headers:{'Content-Range':'bytes 0-2/100','Content-Length':'3','Accept-Ranges':'bytes','Set-Cookie':'do-not-forward'}});};
 const response=await worker.fetch(new Request(url,{headers:{Range:'bytes=0-2'}}),{});
 assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),'bytes 0-2/100');assert.equal(response.headers.get('Set-Cookie'),null);assert.equal(upstreamRequest.init.headers.get('Range'),'bytes=0-2');assert.ok(upstreamRequest.source.startsWith('http://www.hinsonchurch.net/audio/'));
 assert.equal((await worker.fetch(new Request('https://app.example/archive-audio/not-listed.mp3'),{})).status,404);
 assert.equal((await worker.fetch(new Request(url,{method:'POST'}),{})).status,405);
 assert.equal((await worker.fetch(new Request('https://app.example/'),{ASSETS:{fetch:()=>new Response('static')}})).status,200);
 const assets={ASSETS:{fetch:()=>Response.json({sermons:[{id:'test-id',date:'2026-10-04',title:'Title "safe"',audio:'https://static1.squarespace.com/audio.mp3'}]})}};
 const dl=await worker.fetch(new Request('https://app.example/download/test-id'),assets);
 assert.equal(dl.status,206);assert.equal(dl.headers.get('Content-Disposition'),'attachment; filename="2026-10-04-Title-safe.mp3"');
 assert.equal((await worker.fetch(new Request('https://app.example/download/missing'),assets)).status,404);
 console.log('Audio streaming, range, allowlist, and asset routing checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
