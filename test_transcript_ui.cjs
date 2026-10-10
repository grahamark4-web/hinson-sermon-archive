// Test the actual UI script with a small DOM and media stub, without publishing fixtures.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element{
 constructor(tag,text=''){this.tagName=tag;this.textContent=text;this.children=[];this.attributes={};this.listeners={};this.value='';this.paused=true;this.ended=false;this.readyState=0;this.duration=120;this.currentTime=0;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=v;if(k==='src')this.src=v;}getAttribute(k){return k==='src'?this.src:this.attributes[k]??null;}
 addEventListener(event,fn){(this.listeners[event]||=([])).push(fn);}emit(event){for(const fn of this.listeners[event]||[])fn();}
 click(){this.emit('click');}focus(){}pause(){this.paused=true;this.emit('pause');}play(){this.paused=false;this.emit('play');return Promise.resolve();}
 all(){return [this,...this.children.flatMap(c=>c.all())];}querySelector(s){return this.all().find(n=>s.startsWith('.')?n.className===s.slice(1):n.tagName===s)||null;}
}
(async()=>{
 const ids=Object.fromEntries(['transcripts','query','book','speaker','year','series','sort','clear','more','results','updated','status','transcript-status'].map(id=>[id,new Element('div')]));ids.transcripts.checked=true;ids.sort.value='newest';ids.query.placeholder='Search';
 const disclosure=new Element('details');const sermon={id:'test',title:'A sermon',date:'2026-10-04',speaker:'A preacher',audio:'https://example.com/sermon.mp3',passages:[],books:['Romans'],series:['A series']};
 const document={getElementById:id=>ids[id],createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:text=>new Element('#text',text),createDocumentFragment:()=>new Element('fragment'),querySelector:()=>disclosure,querySelectorAll:tag=>ids.results.all().filter(e=>e.tagName===tag)};
 const context={document,console,URL,URLSearchParams,location:{href:'https://app.example/',search:''},history:{replaceState(){}},matchMedia:()=>({matches:false,addEventListener(){}}),setTimeout,clearTimeout,AbortController,SermonSearch:require('./search.js'),fetch:async(url)=>({ok:true,json:async()=>url==='sermons.json'?{sermons:[sermon],updatedAt:'2026-10-04'}:url==='podcast-links.json'?{links:{}}:url==='/transcript-search/manifest.json'?{coverage:1}:{coverage:1,matches:{test:{sourceAudio:sermon.audio,excerpts:[{start:41.5,text:'Bring your worry to God.',terms:['worry']},{start:90,text:'Pray when you are anxious.',terms:['anxious']}]}}}})};
 context.window=context;context.window.parent=context;vm.createContext(context);vm.runInContext(fs.readFileSync('app.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));ids.query.value='anxiety';await context.requestTranscripts();
 const jumps=ids.results.all().filter(n=>n.className==='timestamp');assert.equal(jumps.length,2);assert.equal(jumps[0].children.find(n=>n.tagName==='span').textContent,'Listen at 0:41');
 jumps[0].click();const audio=document.querySelectorAll('audio')[0];assert.equal(audio.paused,false);audio.readyState=1;audio.emit('loadedmetadata');assert.equal(audio.currentTime,41.5,'seek occurs when metadata is ready');
 jumps[1].click();assert.equal(audio.currentTime,90,'existing player seeks to the next match');
 ids.transcripts.checked=false;ids.transcripts.emit('change');assert.equal(ids.results.all().filter(n=>n.className==='sermon').length,0,'turning transcript search off removes transcript-only matches');
 ids.transcripts.checked=true;ids.transcripts.emit('change');await new Promise(resolve=>setImmediate(resolve));assert.equal(ids.results.all().filter(n=>n.className==='sermon').length,1,'turning transcript search on restores matches');
 ids.book.value='Genesis';ids.book.emit('change');assert.equal(ids.results.all().filter(n=>n.className==='sermon').length,0,'filters apply to transcript results');
 console.log('Transcript UI excerpts, timestamp playback and filtering checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
