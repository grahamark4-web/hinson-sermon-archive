'use strict';
const $=id=>document.getElementById(id);let sermons=[],platformLinks={},limit=30,filtered=[];
const controls=['query','book','speaker','year','series','sort'];
const mobileSearch=matchMedia('(max-width:700px)');
const desktopPlaceholder=$('query').placeholder;
function updateSearchPlaceholder(){ $('query').placeholder=mobileSearch.matches?'Search':desktopPlaceholder; }
updateSearchPlaceholder();mobileSearch.addEventListener('change',updateSearchPlaceholder);
const params=new URLSearchParams(location.search);if(params.get('embed')==='1')document.body.classList.add('embedded');if(matchMedia('(max-width:700px)').matches)document.querySelector('.filter-disclosure').open=false;for(const id of controls)if(params.has(id))$(id).value=params.get(id);
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function link(text,url){const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener';return a;}
function highlight(node,reference=false){
 const text=node.textContent,ranges=SermonSearch.highlightRanges(text,$('query').value,reference);
 if(!ranges.length)return node;
 node.textContent='';let cursor=0;
 for(const [start,end] of ranges){node.append(document.createTextNode(text.slice(cursor,start)),el('mark',text.slice(start,end),'search-highlight'));cursor=end;}
 node.append(document.createTextNode(text.slice(cursor)));return node;
}
function updateFilterOptions(){
 const selection=Object.fromEntries(controls.map(id=>[id,$(id).value]));
 const options=SermonSearch.facets(sermons,selection);
 for(const id of ['book','speaker','year','series']){
  const select=$(id),selected=selection[id],all={book:'All books',speaker:'All preachers',year:'All years',series:'All series'}[id];
  const blank=el('option',all);blank.value='';
  const items=options[id].map(value=>{const o=el('option',value);o.value=value;return o;});
  if(selected&&!options[id].includes(selected)){const o=el('option',selected+' (no matches)');o.value=selected;items.unshift(o);}
  select.replaceChildren(blank,...items);select.value=selected;
 }
}
function render(){
 updateFilterOptions();
 const selection=Object.fromEntries(controls.map(id=>[id,$(id).value]));
 filtered=sermons.filter(s=>SermonSearch.matches(s,selection.query)&&SermonSearch.filterMatches(s,selection));
 if($('sort').value==='oldest')filtered.sort((a,b)=>a.date.localeCompare(b.date));else if($('sort').value==='title')filtered.sort((a,b)=>a.title.localeCompare(b.title));else filtered.sort((a,b)=>b.date.localeCompare(a.date));
 const fragment=document.createDocumentFragment();
 for(const s of filtered.slice(0,limit)){
  const article=el('article',undefined,'sermon'),date=el('time',new Date(s.date+'T12:00:00Z').toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}),'date');date.dateTime=s.date;article.append(date);
  const content=el('div'),title=el('h2');const normalize=t=>t.toLowerCase().replace(/[^a-z0-9]/g,'');const parts=s.title.split('|').map(t=>t.trim());const cleanParts=parts.length>1?parts.filter(t=>!s.passages.some(p=>normalize(p.reference)===normalize(t))):parts;const titleText=el('span',cleanParts.join(' | ')||s.title,'sermon-title');title.append(highlight(titleText));content.append(title);
  const meta=el('p',undefined,'meta');const passage=el('span',undefined,'passage');if(s.passages.length){s.passages.forEach((p,i)=>{if(i)passage.append(document.createTextNode('; '));passage.append(highlight(el('span',p.reference),true));});}else passage.append(highlight(el('span',s.books.join(', ')||'Passage not listed')));meta.append(passage,document.createTextNode('  ·  '),highlight(el('span',s.speaker||'Preacher not listed')));content.append(meta);
  content.append(highlight(el('p',SermonSearch.seriesValues(s).join(' · '),'meta')));
  const actions=el('div',undefined,'actions');
  if(s.audio){const play=el('button',undefined,'play');const label=el('span','Listen');const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 16 16');icon.setAttribute('width','14');icon.setAttribute('height','14');icon.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M4 2 L13 8 L4 14 Z');path.setAttribute('fill','currentColor');icon.append(path);play.append(icon,label);play.type='button';play.setAttribute('aria-pressed','false');play.setAttribute('aria-label','Listen to '+s.title);play.addEventListener('click',()=>{const existing=content.querySelector('audio');if(existing){existing.paused?existing.play().catch(()=>{}):existing.pause();return;}document.querySelectorAll('audio').forEach(a=>a.pause());const wrap=el('div',undefined,'audio-wrap'),a=el('audio');a.controls=true;a.preload='none';a.src=s.audio;a.setAttribute('aria-label',s.title);const state=()=>{const active=!a.paused&&!a.ended;label.textContent=active?'Pause':'Listen';path.setAttribute('d',active?'M3 2 H6 V14 H3 Z M10 2 H13 V14 H10 Z':'M4 2 L13 8 L4 14 Z');play.setAttribute('aria-label',(active?'Pause ':'Listen to ')+s.title);play.setAttribute('aria-pressed',String(active));};a.addEventListener('play',state);a.addEventListener('pause',state);a.addEventListener('ended',state);a.addEventListener('error',()=>{if(s.originalAudio&&s.originalAudio.startsWith('https://')&&a.getAttribute('src')!==s.originalAudio){a.src=s.originalAudio;a.play().catch(()=>{});}else if(!wrap.querySelector('.notice'))wrap.append(el('p','Audio is temporarily unavailable. Try an available podcast link below.','notice'));});wrap.append(a);content.append(wrap);a.play().catch(()=>{});});actions.append(play);}
  const platforms=platformLinks[s.id]||{};for(const [name,url] of [['Spotify',platforms.spotify],['Apple Podcasts',platforms.apple]]){if(url){const a=link(name+' ↗',url);a.className='platform-link';a.setAttribute('aria-label',name+': '+s.title);actions.append(a);}}if(s.audio){const options=el('details',undefined,'audio-options');const download=el('a','Download');download.href='/download/'+encodeURIComponent(s.id);download.setAttribute('download','');options.append(el('summary','More options'),link('Open in new tab',s.audio),download);actions.append(options);}content.append(actions);if(!s.audio&&!s.legacyAudio)content.append(el('p','Use an available podcast link below to listen.','notice'));
  if(s.legacyAudio)content.append(el('p','This sermon uses an older audio link. Try an available podcast link below if it does not play.','notice'));
  article.append(content);fragment.append(article);
 }
 $('results').replaceChildren(fragment);
 if(!filtered.length)$('results').append(el('div','No sermons match these filters. Try another passage or clear the filters.','empty'));
 $('status').textContent=filtered.length.toLocaleString()+' sermon'+(filtered.length===1?'':'s')+' found'+(filtered.length>limit?' · showing '+limit:'');$('more').hidden=filtered.length<=limit;
 $('clear').hidden=!controls.some(id=>$(id).value&&(id!=='sort'||$(id).value!=='newest'));const next=new URL(location.href);for(const id of controls){if($(id).value&&(id!=='sort'||$(id).value!=='newest'))next.searchParams.set(id,$(id).value);else next.searchParams.delete(id);}history.replaceState(null,'',next);
}
for(const id of controls)$(id).addEventListener(id==='query'?'input':'change',()=>{limit=30;render();});
$('clear').addEventListener('click',()=>{for(const id of controls)$(id).value=id==='sort'?'newest':'';limit=30;render();$('query').focus();});
$('more').addEventListener('click',()=>{limit+=30;render();});
Promise.all([fetch('sermons.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json();}),fetch('podcast-links.json',{cache:'no-cache'}).then(r=>r.ok?r.json():{links:{}}).catch(()=>({links:{}}))]).then(([data,platformData])=>{platformLinks=platformData.links||{};sermons=data.sermons;for(const id of ['book','speaker','year','series']){if(params.has(id)){const o=el('option',params.get(id));o.value=params.get(id);$(id).append(o);$(id).value=params.get(id);}}$('updated').textContent='Catalog updated '+new Date(data.updatedAt).toLocaleDateString();render();}).catch(()=>{$('status').textContent='The archive could not load. Please refresh and try again.';});

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
