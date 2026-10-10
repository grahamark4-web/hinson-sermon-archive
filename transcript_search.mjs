// A server-side inverted index: visitors receive excerpts, never the full corpus.
export function tokens(text){return String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];}
export function bucket(term){let n=2166136261;for(const c of term)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)%64;}
const stop=new Set('a an and are as at be been but by for from had has have he her him his i in is it its of on or our that the their them they this to was we were will with you your'.split(' '));
// Explicit topic synonyms; this is related-word search, not AI interpretation.
const topics={anxiety:['anxiety','anxious','worry','worried','fear'],forgiveness:['forgiveness','forgive','forgiven','forgiving'],prayer:['prayer','pray','praying'],suffering:['suffering','suffer','pain','affliction'],marriage:['marriage','married','husband','wife'],parenting:['parenting','parents','parent','children'],money:['money','wealth','riches','financial'],salvation:['salvation','saved','save','redemption'],repentance:['repentance','repent','repenting'],grief:['grief','grieving','mourning','bereavement'],leadership:['leadership','leaders','leader','elders'],evangelism:['evangelism','evangelize','witness','outreach'],humility:['humility','humble','pride'],baptism:['baptism','baptize','baptized'],resurrection:['resurrection','risen','raised'],generosity:['generosity','generous','giving'],loneliness:['loneliness','lonely','alone']};
export function queryGroups(query){const all=tokens(query),quoted=/^\s*["“].+["”]\s*$/.test(query);return {quoted,phrase:all.join(' '),groups:quoted?all.map(t=>[t]):all.filter(t=>!stop.has(t)).map(t=>topics[t]||[t])};}
async function asset(env,url,path){const r=await env.ASSETS.fetch(new Request(new URL(path,url)));if(!r.ok)throw Error('Transcript index unavailable');return r.json();}
export async function searchTranscripts(request,env){
 const url=new URL(request.url),q=(url.searchParams.get('q')||'').trim();
 if(q.length>200)return Response.json({error:'Search is limited to 200 characters.'},{status:400});
 let manifest;try{manifest=await asset(env,url,'/transcript-search/manifest.json');}catch{return Response.json({coverage:0,matches:{}});}
 const {groups,quoted,phrase}=queryGroups(q);
 if(!manifest.coverage||!groups.length||groups.length>40)return Response.json({coverage:manifest.coverage,matches:{}});
 try{
  const buckets=[...new Set(groups.flat().map(bucket))];
  const shards=await Promise.all(buckets.map(b=>asset(env,url,`/transcript-search/terms-${b}.json`)));
  const index=Object.assign({},...shards),sets=groups.map(g=>new Set(g.flatMap(t=>index[t]||[])));
  sets.sort((a,b)=>a.size-b.size);
  const candidates=[...sets[0]].filter(id=>sets.every(set=>set.has(id))).slice(0,5000);
  const allPages=[...new Set(candidates.map(id=>Math.floor(id/500)))],pages=allPages.slice(0,Math.max(1,45-buckets.length));
  const chunks=Object.assign({},...await Promise.all(pages.map(p=>asset(env,url,`/transcript-search/passages-${p}.json`))));
  const matches={};
  for(const id of candidates){const c=chunks[id];if(!c)continue;const normalized=tokens(c.text).join(' ');if(quoted&&!(' '+normalized+' ').includes(' '+phrase+' '))continue;
   const doc=manifest.documents[c.sermonId];if(!doc)continue;
   const hit=matches[c.sermonId]||(matches[c.sermonId]={sourceAudio:doc.sourceAudio,excerpts:[]});
   const segment=c.segments.find(s=>groups.some(g=>g.some(t=>tokens(s.text).includes(t))))||c.segments[0];
   if(hit.excerpts.some(e=>Math.abs(e.start-segment.start)<15)||hit.excerpts.length>=3)continue;
   hit.excerpts.push({start:segment.start,end:c.end,text:c.text.slice(0,500),terms:groups.flat().filter(t=>tokens(c.text).includes(t))});
  }
  return Response.json({coverage:manifest.coverage,matches,truncated:candidates.length===5000||pages.length<allPages.length},{headers:{'Cache-Control':'public, max-age=300'}});
 }catch{return Response.json({error:'Sermon text search is temporarily unavailable.'},{status:503});}
}
