// Test the actual UI script with a small DOM and media stub, without publishing fixtures.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element{
 constructor(tag,text=''){this.tagName=tag;this.textContent=text;this.children=[];this.attributes={};this.listeners={};this.value='';this.paused=true;this.ended=false;this.readyState=0;this.duration=120;this.currentTime=0;this.style={};this.classList={add(){},remove(){}};this.offsetHeight=120;}
 append(...nodes){this.children.push(...nodes);nodes.forEach(n=>n.parentElement=this);}replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=v;if(k==='src')this.src=v;}getAttribute(k){return k==='src'?this.src:this.attributes[k]??null;}
 select(){this.selected=true;}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
 removeAttribute(k){delete this.attributes[k];}matches(s){const cls=s.match(/^\.([a-z-]+)/);if(cls&&(this.className||'').split(' ').includes(cls[1])===false)return false;if(!cls&&this.tagName!==s)return false;const attr=s.match(/\[([^=\]]+)(?:="([^"]*)")?\]/);if(attr){if(attr[1]==='open')return !!this.open;return attr[2]===undefined?this.attributes[attr[1]]!==undefined:this.attributes[attr[1]]===attr[2];}return true;}closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
 addEventListener(event,fn){(this.listeners[event]||=([])).push(fn);}emit(event){for(const fn of this.listeners[event]||[])fn();}
 click(){this.emit('click');}focus(){}pause(){this.paused=true;this.emit('pause');}play(){this.paused=false;this.emit('play');return Promise.resolve();}
 all(){return [this,...this.children.flatMap(c=>c.all())];}querySelector(s){return this.all().find(n=>n.matches(s))||null;}
}
(async()=>{
 const ids=Object.fromEntries(['transcripts','query','book','speaker','year','series','sort','clear','more','results','updated','status','transcript-status','mini-player','archive-audio','player-title','player-toggle','player-seek','player-time','player-notice','player-progress','player-back','player-forward','player-share','player-close'].map(id=>[id,new Element('div')]));ids.transcripts.checked=true;ids.sort.value='newest';ids.query.placeholder='Search';
 ids['archive-audio'].tagName='audio';ids['mini-player'].hidden=true;
 const disclosure=new Element('details');disclosure.className='filter-disclosure';disclosure.append(new Element('summary'));const filterBody=new Element('div');filterBody.className='filters';const panel=new Element('section');panel.className='search-panel';const sermon={id:'test',title:'A sermon',date:'2026-10-04',speaker:'A preacher',audio:'https://example.com/sermon.mp3',passages:[],books:['Romans'],series:['A series']};
 const docEvents={};const allNodes=()=>[...Object.values(ids).flatMap(e=>e.all()),...disclosure.all(),filterBody,panel];
 const document={body:new Element('body'),addEventListener:(type,fn)=>(docEvents[type]||=[]).push(fn),getElementById:id=>ids[id],createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:text=>new Element('#text',text),createDocumentFragment:()=>new Element('fragment'),querySelector:s=>allNodes().find(e=>e.matches(s))||null,querySelectorAll:s=>allNodes().filter(e=>e.matches(s))};
 let copied='';const context={navigator:{clipboard:{writeText:async text=>{copied=text;}}},addEventListener(){},document,console,URL,URLSearchParams,location:{href:'https://app.example/',search:''},history:{replaceState(){}},matchMedia:()=>({matches:false,addEventListener(){}}),setTimeout,clearTimeout,AbortController,SermonSearch:require('./search.js'),fetch:async(url)=>({ok:true,json:async()=>url==='sermons.json'?{sermons:[sermon],updatedAt:'2026-10-04'}:url==='podcast-links.json'?{links:{}}:url==='/transcript-search/manifest.json'?{coverage:1}:url==='/transcripts/test.json'?{sourceAudio:sermon.audio,segments:[{start:0,text:'Earlier context.'},{start:41.5,text:'Bring your worry to God.'},{start:50,text:'Surrounding words for understanding.'},{start:90,text:'Pray when you are anxious.'}]}:{coverage:1,matches:{test:{sourceAudio:sermon.audio,excerpts:[{start:41.5,text:'Bring your worry to God.',terms:['worry']},{start:90,text:'Pray when you are anxious.',terms:['anxious']}]}}}})};
 context.window=context;context.window.parent=context;vm.createContext(context);vm.runInContext(fs.readFileSync('interactions.js','utf8'),context);vm.runInContext(fs.readFileSync('app.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));ids.query.value='anxiety';await context.requestTranscripts();
 const jumps=ids.results.all().filter(n=>n.className==='timestamp');assert.equal(jumps.length,2);assert.equal(jumps[0].children.find(n=>n.tagName==='span').textContent,'Listen at 0:41');
 jumps[0].click();const audio=document.querySelectorAll('audio')[0];assert.equal(audio.paused,false);audio.readyState=1;audio.emit('loadedmetadata');assert.equal(audio.currentTime,41.5,'seek occurs when metadata is ready');
 jumps[1].click();assert.equal(audio.currentTime,90,'existing player seeks to the next match');
 const stableIcon=ids['player-toggle'].children[0];for(let i=0;i<5;i++)audio.emit('timeupdate');assert.equal(ids['player-toggle'].children[0],stableIcon,'clock updates never replace the clicked icon');
 ids['player-toggle'].click();assert.equal(audio.paused,true,'pause acts synchronously');ids['player-toggle'].click();assert.equal(audio.paused,false);
 const shared=vm.runInContext('ArchiveUI.shareUrl({id:"test"},90)',context);assert.equal(shared,'https://app.example/?sermon=test&t=90');
 const moreText=ids.results.all().find(n=>n.className==='read-more');moreText.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(moreText.getAttribute('aria-expanded'),'true');assert.match(ids.results.all().find(n=>n.className==='excerpt-context').all().map(n=>n.textContent).join(' '),/Surrounding words/);
 const share=ids.results.all().find(n=>n.className==='share-button');share.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(share.textContent,'✓ Copied');assert.equal(copied,'https://app.example/?sermon=test');
 context.navigator.clipboard.writeText=async()=>{throw Error('Clipboard blocked in embed');};
 share.click();await new Promise(resolve=>setImmediate(resolve));share.click();await new Promise(resolve=>setImmediate(resolve));share.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(share.textContent,"Couldn’t copy");assert.equal(document.body.children.length,0,'failed copies leave no address field');
 document.execCommand=()=>{const field=document.body.children[0];assert.equal(field.selected,true);copied=field.value;return true;};
 for(let i=0;i<3;i++){share.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(share.textContent,'✓ Copied');assert.equal(document.body.children.length,0);}
 assert.equal(copied,'https://app.example/?sermon=test','embedded fallback copies correct link without showing it');
 document.execCommand=()=>false;context.navigator.clipboard.writeText=async text=>{copied=text;};
 ids.transcripts.checked=false;ids.transcripts.emit('change');assert.equal(ids.results.all().filter(n=>n.className==='sermon').length,0,'turning transcript search off removes transcript-only matches');assert.equal(document.querySelectorAll('audio')[0],audio,'player survives result rebuild');assert.equal(audio.paused,false,'filtering does not stop playback');assert.equal(ids['mini-player'].hidden,false);
 ids.transcripts.checked=true;ids.transcripts.emit('change');await new Promise(resolve=>setImmediate(resolve));assert.equal(ids.results.all().filter(n=>n.className==='sermon').length,1,'turning transcript search on restores matches');
 const menu=ids.results.all().find(n=>n.className==='audio-options');menu.open=true;for(const fn of docEvents.keydown||[])fn({key:'Escape'});assert.equal(menu.open,false,'Escape closes menu');menu.open=true;for(const fn of docEvents.click||[])fn({target:panel});assert.equal(menu.open,false,'outside click closes menu');
 ids.book.value='Genesis';ids.book.emit('change');assert.equal(ids.results.all().filter(n=>n.className==='sermon').length,0,'filters apply to transcript results');
 const menus=ids.results.all().filter(n=>n.className==='audio-options');if(menus.length){menus[0].open=true;for(const fn of docEvents.keydown||[])fn({key:'Escape'});assert.equal(menus[0].open,false);}
 ids['player-back'].click();assert.equal(audio.currentTime,75);ids['player-forward'].click();assert.equal(audio.currentTime,90);ids['player-close'].click();assert.equal(audio.paused,true);assert.equal(ids['mini-player'].hidden,true);
 const normalPlay=audio.play.bind(audio);let rejectStart;audio.play=()=>new Promise((_,reject)=>{rejectStart=reject;});
 vm.runInContext('ArchiveUI.listen({id:"slow",title:"Slow recording",audio:"https://example.com/slow.mp3",originalAudio:"https://example.com/fallback.mp3"})',context);
 assert.equal(ids['player-toggle'].getAttribute('aria-pressed'),'true','pending playback offers Pause immediately');
 const originalSource=audio.src;ids['player-toggle'].click();assert.equal(audio.paused,true);assert.equal(ids['player-toggle'].getAttribute('aria-pressed'),'false');
 rejectStart(Object.assign(new Error('cancelled'),{name:'AbortError'}));await new Promise(resolve=>setImmediate(resolve));assert.equal(ids['player-notice'].textContent,'','cancelled play does not show an error');
 let replayCount=0;audio.play=()=>{replayCount++;return normalPlay();};audio.emit('error');assert.notEqual(audio.src,originalSource);assert.equal(replayCount,0,'fallback never starts a paused recording');
 ids['player-toggle'].click();assert.equal(replayCount,1);assert.equal(audio.paused,false);ids['player-toggle'].click();assert.equal(audio.paused,true);
 audio.play=()=>new Promise((_,reject)=>{rejectStart=reject;});
 vm.runInContext('ArchiveUI.listen({id:"old",title:"Old",audio:"https://example.com/old.mp3"})',context);const rejectOld=rejectStart;
 audio.play=normalPlay;vm.runInContext('ArchiveUI.listen({id:"new",title:"New",audio:"https://example.com/new.mp3"})',context);
 rejectOld(new Error('old failed'));await new Promise(resolve=>setImmediate(resolve));assert.equal(audio.paused,false);assert.equal(ids['player-toggle'].getAttribute('aria-pressed'),'true');assert.equal(ids['player-notice'].textContent,'');
 ids['player-close'].click();
 console.log('Transcript UI excerpts, timestamp playback and filtering checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
