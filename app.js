'use strict';
const $=id=>document.getElementById(id);let sermons=[],platformLinks={},limit=30,filtered=[];
let visibleSermonIds=new Set();
let transcriptHits={},transcriptQuery='',transcriptCoverage=0,transcriptTimer,transcriptRequest,transcriptGeneration=0;
function searchMatches(sermon,q){return SermonSearch.matches(sermon,q)||($('transcripts').checked&&q.trim()===transcriptQuery&&transcriptHits[sermon.id]?.sourceAudio===sermon.audio);}
async function requestTranscripts(){
 const q=$('query').value.trim(),generation=++transcriptGeneration;transcriptRequest?.abort();ArchiveUI.loading(false);
 transcriptHits={};transcriptQuery=q;
 if(!$('transcripts').checked||!q||SermonSearch.parse(q)){render();return;}
 transcriptRequest=new AbortController();ArchiveUI.loading(true);$('transcript-status').textContent='Searching sermon transcripts…';
 try{const r=await fetch('/api/transcript-search?q='+encodeURIComponent(q)+'&v=apostrophe-2',{signal:transcriptRequest.signal});if(!r.ok)throw Error('Search unavailable');const data=await r.json();if(generation!==transcriptGeneration)return;ArchiveUI.loading(false);transcriptHits=data.matches||{};transcriptCoverage=data.coverage||0;render(true);if(data.truncated)$('transcript-status').textContent+=mobileSearch.matches?' · Try a more specific phrase.':' · Try a more specific phrase for additional matches.';}
 catch(error){if(error.name!=='AbortError'&&generation===transcriptGeneration){ArchiveUI.loading(false);render();$('transcript-status').textContent=mobileSearch.matches?'Transcript search unavailable. Try again.':'Transcript search is temporarily unavailable. Title and Scripture search still work.';}}
}
const controls=['query','book','speaker','year','series','sort'];
const mobileSearch=matchMedia('(max-width:700px)');
const desktopPlaceholder=$('query').placeholder;
function updateSearchPlaceholder(){ $('query').placeholder=$('transcripts').checked?'Search Sermon Transcripts':mobileSearch.matches?'Search':desktopPlaceholder; }
updateSearchPlaceholder();mobileSearch.addEventListener('change',()=>{updateSearchPlaceholder();render();});
const params=new URLSearchParams(location.search);try{$('transcripts').checked=localStorage.getItem('hinson-search-transcripts')==='on';}catch{}if(params.has('transcripts'))$('transcripts').checked=params.get('transcripts')!=='0';if(params.get('embed')==='1')document.body.classList.add('embedded');if(matchMedia('(max-width:700px)').matches)document.querySelector('.filter-disclosure').open=false;for(const id of controls)if(params.has(id))$(id).value=params.get(id);
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function link(text,url){const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener';return a;}
function smallIcon(kind){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('width','16');svg.setAttribute('height','16');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('fill','currentColor');path.setAttribute('d',kind==='play'?'M4 2 L13 8 L4 14 Z':kind==='close'?'M4 3 L8 7 L12 3 L13 4 L9 8 L13 12 L12 13 L8 9 L4 13 L3 12 L7 8 L3 4 Z':'M3 6 A2 2 0 1 1 3 10 A2 2 0 1 1 3 6 M8 6 A2 2 0 1 1 8 10 A2 2 0 1 1 8 6 M13 6 A2 2 0 1 1 13 10 A2 2 0 1 1 13 6');svg.append(path);return svg;
}
function highlight(node,reference=false,query=$('query').value){
 const text=node.textContent,ranges=SermonSearch.highlightRanges(text,query.replace(/^[\s"“]+|[\s"”]+$/g,''),reference);
 if(!ranges.length)return node;
 node.textContent='';let cursor=0;
 for(const [start,end] of ranges){node.append(document.createTextNode(text.slice(cursor,start)),el('mark',text.slice(start,end),'search-highlight'));cursor=end;}
 node.append(document.createTextNode(text.slice(cursor)));return node;
}
function updateFilterOptions(){
 const selection=Object.fromEntries(controls.map(id=>[id,$(id).value]));
 const options=SermonSearch.facets(sermons,selection,searchMatches);
 for(const id of ['book','speaker','year','series']){
  const select=$(id),selected=selection[id],all={book:'All books',speaker:'All preachers',year:'All years',series:'All series'}[id];
  const blank=el('option',all);blank.value='';
  const items=options[id].map(value=>{const o=el('option',value);o.value=value;return o;});
  if(selected&&!options[id].includes(selected)){const o=el('option',selected+' (no matches)');o.value=selected;items.unshift(o);}
  select.replaceChildren(blank,...items);select.value=selected;
 }
}
function render(animateNew=false){
 updateSearchPlaceholder();
 $('transcript-status').textContent=!$('transcripts').checked?'Transcript search is off.':transcriptCoverage?(mobileSearch.matches?transcriptCoverage+' sermons transcribed.':'Searchable transcripts for '+transcriptCoverage+' sermons · Matches exact words and phrases.'):'Sermon transcription is in progress.';
 updateFilterOptions();
 const selection=Object.fromEntries(controls.map(id=>[id,$(id).value]));
 filtered=sermons.filter(s=>(!params.get('sermon')||s.id===params.get('sermon'))&&searchMatches(s,selection.query)&&SermonSearch.filterMatches(s,selection));
 filtered.sort((a,b)=>{
  const priority=SermonSearch.scripturePriority(a,selection.query)-SermonSearch.scripturePriority(b,selection.query);
  if(priority)return priority;
  if($('sort').value==='oldest')return a.date.localeCompare(b.date);
  if($('sort').value==='title')return a.title.localeCompare(b.title);
  return b.date.localeCompare(a.date);
 });
 const fragment=document.createDocumentFragment();
 for(const s of filtered.slice(0,limit)){
  const article=el('article',undefined,'sermon'),date=el('time',new Date(s.date+'T12:00:00Z').toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}),'date');date.dateTime=s.date;article.append(date);if(animateNew&&!visibleSermonIds.has(s.id))article.setAttribute('data-enter','true');
  const content=el('div'),title=el('h2');const normalize=t=>t.toLowerCase().replace(/[^a-z0-9]/g,'');const parts=s.title.split('|').map(t=>t.trim());const cleanParts=parts.length>1?parts.filter(t=>!s.passages.some(p=>normalize(p.reference)===normalize(t))):parts;const titleText=el('span',cleanParts.join(' | ')||s.title,'sermon-title');title.append(highlight(titleText));content.append(title);
  const meta=el('p',undefined,'meta');const passage=el('span',undefined,'passage');if(s.passages.length){s.passages.forEach((p,i)=>{if(i)passage.append(document.createTextNode('; '));passage.append(highlight(el('span',p.reference),true));});}else passage.append(highlight(el('span',s.books.join(', ')||'Passage not listed')));meta.append(passage,document.createTextNode('  ·  '),highlight(el('span',s.speaker||'Preacher not listed')));content.append(meta);
  content.append(highlight(el('p',SermonSearch.seriesValues(s).join(' · '),'meta')));
  const actions=el('div',undefined,'actions');
  const startPlayback=seconds=>ArchiveUI.listen(s,seconds);
  if(s.audio){
   const play=el('button',undefined,'play');play.type='button';play.append(smallIcon('play'),el('span','Listen'));play.setAttribute('aria-pressed','false');play.setAttribute('aria-label','Listen to '+s.title);
   ArchiveUI.bindPlay(play,s,params.get('sermon')===s.id?Number(params.get('t'))||0:undefined);actions.append(play);
  }
  actions.append(ArchiveUI.shareButton(s));

  const platforms=platformLinks[s.id]||{};for(const [name,url] of [['Spotify',platforms.spotify],['Apple Podcasts',platforms.apple]]){if(url){const a=link(undefined,url);a.className='platform-link';a.title=name;const logo=el('img');logo.src=name==='Spotify'?'assets/spotify.svg':'assets/apple-podcasts.svg';logo.alt='';logo.width=20;logo.height=20;logo.setAttribute('aria-hidden','true');a.append(logo);a.setAttribute('aria-label',name+': '+s.title);actions.append(a);}}if(s.audio){const options=el('details',undefined,'audio-options');const download=el('a','Download');download.href='/download/'+encodeURIComponent(s.id);download.setAttribute('download','');const summary=el('summary',undefined,'options-toggle');summary.setAttribute('aria-label','More options for '+s.title);summary.title='More options';summary.append(smallIcon('more'));options.append(summary,link('Open in new tab',s.audio),download);actions.append(options);}content.append(actions);if(!s.audio&&!s.legacyAudio)content.append(el('p','Use an available podcast link below to listen.','notice'));
  if(s.legacyAudio)content.append(el('p','This sermon uses an older audio link. Try an available podcast link below if it does not play.','notice'));
  const transcript=$('transcripts').checked&&transcriptQuery===$('query').value.trim()?transcriptHits[s.id]:null;
  if(transcript&&transcript.sourceAudio===s.audio&&transcript.excerpts.length){
   const excerpts=el('div',undefined,'transcript-matches');excerpts.append(el('p','From the sermon · Automatically transcribed','transcript-label'));
   for(const excerpt of transcript.excerpts.slice(0,2)){
    const block=el('div',undefined,'transcript-excerpt');block.append(highlight(el('p','“'+excerpt.text+'”'),false,(excerpt.terms||[]).join(' ')||$('query').value));
    const minutes=Math.floor(excerpt.start/60),seconds=Math.floor(excerpt.start%60),stamp=minutes+':'+String(seconds).padStart(2,'0');
    const jump=el('button',undefined,'timestamp');jump.append(smallIcon('play'),el('span','Listen at '+stamp));jump.type='button';jump.setAttribute('aria-label','Listen to '+s.title+' at '+stamp);jump.addEventListener('click',()=>startPlayback?.(excerpt.start));block.append(jump);ArchiveUI.excerptMore(block,s,excerpt,p=>highlight(p,false,(excerpt.terms||[]).join(' ')||$('query').value));excerpts.append(block);
   }content.append(excerpts);
  }
  article.append(content);fragment.append(article);
 }
 visibleSermonIds=new Set(filtered.slice(0,limit).map(s=>s.id));
 $('results').replaceChildren(fragment);ArchiveUI.update();
 if(!filtered.length)$('results').append(el('div','No sermons match these filters. Try another passage or clear the filters.','empty'));
 $('status').textContent=filtered.length.toLocaleString()+' sermon'+(filtered.length===1?'':'s')+' found'+(filtered.length>limit?' · showing '+limit:'');$('more').hidden=filtered.length<=limit;
 $('clear').hidden=!params.get('sermon')&&!controls.some(id=>$(id).value&&(id!=='sort'||$(id).value!=='newest'));const next=new URL(location.href);if(!params.get('sermon')){next.searchParams.delete('sermon');next.searchParams.delete('t');}for(const id of controls){if($(id).value&&(id!=='sort'||$(id).value!=='newest'))next.searchParams.set(id,$(id).value);else next.searchParams.delete(id);}if(!$('transcripts').checked)next.searchParams.set('transcripts','0');else next.searchParams.delete('transcripts');history.replaceState(null,'',next);
}
$('transcripts').addEventListener('change',()=>{
 clearTimeout(transcriptTimer);transcriptGeneration++;transcriptRequest?.abort();transcriptHits={};transcriptQuery='';ArchiveUI.loading(false);limit=30;
 try{localStorage.setItem('hinson-search-transcripts',$('transcripts').checked?'on':'off');}catch{}
 render();if($('transcripts').checked)requestTranscripts();
});
for(const id of controls)$(id).addEventListener(id==='query'?'input':'change',()=>{params.delete('sermon');params.delete('t');limit=30;if(id==='query'){clearTimeout(transcriptTimer);transcriptGeneration++;transcriptRequest?.abort();transcriptHits={};transcriptQuery='';ArchiveUI.loading(false);render();transcriptTimer=setTimeout(requestTranscripts,350);}else render();});
$('clear').addEventListener('click',()=>{params.delete('sermon');params.delete('t');clearTimeout(transcriptTimer);transcriptGeneration++;transcriptRequest?.abort();transcriptHits={};transcriptQuery='';ArchiveUI.loading(false);for(const id of controls)$(id).value=id==='sort'?'newest':'';limit=30;render();$('query').focus();});
$('more').addEventListener('click',()=>{limit+=30;render(true);});
Promise.all([fetch('sermons.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json();}),fetch('podcast-links.json',{cache:'no-cache'}).then(r=>r.ok?r.json():{links:{}}).catch(()=>({links:{}}))]).then(([data,platformData])=>{platformLinks=platformData.links||{};sermons=data.sermons;fetch('/transcript-search/manifest.json').then(r=>r.ok?r.json():null).then(m=>{if(m){transcriptCoverage=m.coverage;render();}}).catch(()=>{});for(const id of ['book','speaker','year','series']){if(params.has(id)){const o=el('option',params.get(id));o.value=params.get(id);$(id).append(o);$(id).value=params.get(id);}}$('updated').textContent='Catalog updated '+new Date(data.updatedAt).toLocaleDateString();render();if($('query').value.trim())requestTranscripts();}).catch(()=>{$('status').textContent='The archive could not load. Please refresh and try again.';});

/* Fit the iframe to its content so the containing page owns scrolling. */
if(window.parent!==window){
 let lastEmbedHeight=0,embedFrame=0;
 const reportEmbedHeight=()=>{
  embedFrame=0;
  const height=Math.ceil(document.querySelector('main').getBoundingClientRect().bottom+window.scrollY);
  if(height>0&&height!==lastEmbedHeight){
   lastEmbedHeight=height;
   window.parent.postMessage({type:'hinson-sermon-archive:resize',height},'*');
  }
 };
 const queueEmbedHeight=()=>{if(!embedFrame)embedFrame=requestAnimationFrame(reportEmbedHeight);};
 new ResizeObserver(queueEmbedHeight).observe(document.querySelector('main'));
 window.addEventListener('load',queueEmbedHeight);
 window.addEventListener('resize',queueEmbedHeight);
 if(document.fonts)document.fonts.ready.then(queueEmbedHeight);
 queueEmbedHeight();
}

// Accept a shared sermon after the parent page's embed has loaded.
let parentShareReceived=false;
window.addEventListener('message',event=>{
 if(parentShareReceived||event.source!==window.parent||!['https://www.hinsonchurch.org','https://hinsonchurch.org'].includes(event.origin))return;
 const share=event.data;if(share?.type!=='hinson-sermon-archive:share'||typeof share.sermon!=='string'||! /^[a-zA-Z0-9_-]+$/.test(share.sermon))return;
 parentShareReceived=true;params.set('sermon',share.sermon);params.delete('t');if(Number.isFinite(share.t)&&share.t>0)params.set('t',String(Math.floor(share.t)));
 for(const id of controls)$(id).value=id==='sort'?'newest':'';transcriptHits={};transcriptQuery='';limit=30;render();
});
