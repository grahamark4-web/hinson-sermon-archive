'use strict';
const $=id=>document.getElementById(id);let sermons=[],limit=30,filtered=[];
const controls=['query','book','speaker','year','sort'];
const params=new URLSearchParams(location.search);for(const id of controls)if(params.has(id))$(id).value=params.get(id);
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function link(text,url){const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener';return a;}
function populate(id,values){for(const value of values){const o=el('option',value);o.value=value;$(id).append(o);}if(params.has(id))$(id).value=params.get(id);}
function render(){
 filtered=sermons.filter(s=>SermonSearch.matches(s,$('query').value)&&(!$('book').value||s.books.includes($('book').value))&&(!$('speaker').value||s.speaker===$('speaker').value)&&(!$('year').value||s.date.startsWith($('year').value)));
 if($('sort').value==='oldest')filtered.sort((a,b)=>a.date.localeCompare(b.date));else if($('sort').value==='title')filtered.sort((a,b)=>a.title.localeCompare(b.title));else filtered.sort((a,b)=>b.date.localeCompare(a.date));
 const fragment=document.createDocumentFragment();
 for(const s of filtered.slice(0,limit)){
  const article=el('article',undefined,'sermon'),date=el('time',new Date(s.date+'T12:00:00Z').toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}),'date');date.dateTime=s.date;article.append(date);
  const content=el('div');content.append(el('h2',s.title));
  const meta=el('p',undefined,'meta');meta.append(el('span',s.passages.map(p=>p.reference).join('; ')||s.books.join(', ')||'Passage not listed','passage'),document.createTextNode('  ·  '+(s.speaker||'Speaker not listed')));content.append(meta);
  if(s.series.length)content.append(el('p',s.series.join(' · '),'meta'));
  const actions=el('div',undefined,'actions');
  if(s.audio){const play=el('button','▶ Listen','play');play.type='button';play.setAttribute('aria-label','Listen to '+s.title);play.addEventListener('click',()=>{const existing=content.querySelector('audio');if(existing){existing.paused?existing.play().catch(()=>{}):existing.pause();return;}document.querySelectorAll('audio').forEach(a=>a.pause());const wrap=el('div',undefined,'audio-wrap'),a=el('audio');a.controls=true;a.preload='none';a.src=s.audio;a.setAttribute('aria-label',s.title);wrap.append(a);content.append(wrap);a.play().catch(()=>{});});actions.append(play,link('Open audio ↗',s.audio));}
  actions.append(link('Sermon details ↗',s.url));content.append(actions);
  if(s.legacyAudio)content.append(el('p','This sermon uses an older audio link. Open sermon details to check listening options.','notice'));
  article.append(content);fragment.append(article);
 }
 $('results').replaceChildren(fragment);
 if(!filtered.length)$('results').append(el('div','No sermons match these filters. Try another passage or clear the filters.','empty'));
 $('status').textContent=filtered.length.toLocaleString()+' sermon'+(filtered.length===1?'':'s')+' found'+(filtered.length>limit?' · showing '+limit:'');$('more').hidden=filtered.length<=limit;
 const next=new URL(location.href);for(const id of controls){if($(id).value&&(id!=='sort'||$(id).value!=='newest'))next.searchParams.set(id,$(id).value);else next.searchParams.delete(id);}history.replaceState(null,'',next);
}
for(const id of controls)$(id).addEventListener(id==='query'?'input':'change',()=>{limit=30;render();});
$('clear').addEventListener('click',()=>{for(const id of controls)$(id).value=id==='sort'?'newest':'';limit=30;render();$('query').focus();});
$('more').addEventListener('click',()=>{limit+=30;render();});
fetch('sermons.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json();}).then(data=>{sermons=data.sermons;populate('book',SermonSearch.books.filter(b=>sermons.some(s=>s.books.includes(b))));populate('speaker',[...new Set(sermons.map(s=>s.speaker).filter(Boolean))].sort());populate('year',[...new Set(sermons.map(s=>s.date.slice(0,4)))].sort().reverse());$('updated').textContent='Catalog updated '+new Date(data.updatedAt).toLocaleDateString();render();}).catch(()=>{$('status').textContent='The archive could not load. Please refresh or use the original archive below.';});
