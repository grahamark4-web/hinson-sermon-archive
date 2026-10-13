'use strict';
const ArchiveUI=(()=>{
 const player=document.getElementById('mini-player'),audio=document.getElementById('archive-audio'),title=document.getElementById('player-title'),toggle=document.getElementById('player-toggle'),seek=document.getElementById('player-seek'),clock=document.getElementById('player-time'),notice=document.getElementById('player-notice'),progress=document.getElementById('player-progress');
 let current=null,pendingSeek=null,viewport=null,copyTimers=new WeakMap(),wantPlay=false,playRequest=0;
 const docs=new Map(),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const stamp=n=>{n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
 function position(){if(!player||player.hidden)return;if(window.parent!==window&&viewport){player.style.position='absolute';player.style.bottom='auto';player.style.top=Math.max(viewport.top,viewport.bottom-player.offsetHeight-12)+'px';player.style.visibility=viewport.bottom-viewport.top<player.offsetHeight?'hidden':'visible';}}
 function update(){
  if(!current)return;const active=wantPlay&&!audio.ended,duration=Number.isFinite(audio.duration)?audio.duration:0;
  let path=toggle.querySelector('path');if(!path){const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');path=document.createElementNS('http://www.w3.org/2000/svg','path');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.append(path);toggle.replaceChildren(icon);}path.setAttribute('d',active?'M7 5h4v14H7z M14 5h4v14h-4z':'M8 5v14l11-7z');toggle.setAttribute('aria-label',(active?'Pause ':'Play ')+current.title);toggle.setAttribute('aria-pressed',String(active));
  document.getElementById('player-back').disabled=!duration;document.getElementById('player-forward').disabled=!duration;
  seek.disabled=!duration;seek.max=String(duration||1);seek.value=String(audio.currentTime||0);seek.setAttribute('aria-valuetext',stamp(audio.currentTime)+' of '+stamp(duration));
  clock.textContent=stamp(audio.currentTime)+' / '+stamp(duration);progress.style.width=(duration?100*audio.currentTime/duration:0)+'%';
  document.querySelectorAll('.play[data-sermon-id]').forEach(button=>{
   const selected=button.getAttribute('data-sermon-id')===current.id,on=selected&&active;
   button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',(on?'Pause ':'Listen to ')+button.getAttribute('data-sermon-title'));
   const label=button.querySelector('span'),path=button.querySelector('path');if(label)label.textContent=on?'Pause':'Listen';if(path)path.setAttribute('d',on?'M3 2 H6 V14 H3 Z M10 2 H13 V14 H10 Z':'M4 2 L13 8 L4 14 Z');
  });position();
 }
 function applySeek(){if(pendingSeek!==null&&audio.readyState>=1){audio.currentTime=Math.min(pendingSeek,Number.isFinite(audio.duration)?Math.max(0,audio.duration-.1):pendingSeek);pendingSeek=null;}}
 function pause(){wantPlay=false;playRequest++;audio.pause();notice.textContent='';update();}
 function play(){
  wantPlay=true;const request=++playRequest;notice.textContent='';update();
  audio.play().catch(error=>{if(request!==playRequest||!wantPlay)return;wantPlay=false;if(error.name!=='AbortError')notice.textContent='Press Play to start listening.';update();});
 }
 function listen(sermon,seconds){
  if(!audio)return;const same=current?.id===sermon.id&&current.audio===sermon.audio;
  if(same&&seconds===undefined&&wantPlay){pause();return;}
  notice.textContent='';
  if(!same){pause();current=sermon;audio.src=sermon.audio;audio.setAttribute('aria-label',sermon.title);title.textContent=sermon.title;pendingSeek=Math.max(0,Number(seconds)||0);}
  else if(seconds!==undefined)pendingSeek=Math.max(0,Number(seconds)||0);
  player.hidden=false;document.body.classList.add('has-player');applySeek();play();
 }
 function bindPlay(button,sermon,initialSeconds){
  button.setAttribute('data-sermon-id',sermon.id);button.setAttribute('data-sermon-title',sermon.title);
  if(initialSeconds>0)button.querySelector('span').textContent='Listen at '+stamp(initialSeconds);
  button.addEventListener('click',()=>listen(sermon,current?.id===sermon.id?undefined:initialSeconds));
 }
 function shareUrl(sermon,seconds){const url=new URL('https://www.hinsonchurch.org/sermon-secret-project');url.searchParams.set('sermon',sermon.id);if(seconds>0)url.searchParams.set('t',Math.floor(seconds));return url.href;}
 function copyHidden(text){
  const field=document.createElement('textarea'),focused=document.activeElement;
  field.value=text;field.readOnly=true;field.setAttribute('aria-hidden','true');field.setAttribute('tabindex','-1');
  Object.assign(field.style,{position:'fixed',left:'-9999px',top:'0',opacity:'0',fontSize:'16px'});
  document.body.append(field);let copied=false;
  try{field.focus({preventScroll:true});field.select();copied=!!document.execCommand('copy');}catch{}finally{field.remove();focused?.focus({preventScroll:true});}
  return copied;
 }
 async function share(button,sermon,seconds=0){
  if(button.getAttribute('data-copying')==='true')return;
  const original=button.getAttribute('data-share-label')||button.textContent;button.setAttribute('data-share-label',original);clearTimeout(copyTimers.get(button));button.setAttribute('data-copying','true');
  const url=shareUrl(sermon,seconds);let copied=copyHidden(url);
  if(!copied){try{await navigator.clipboard.writeText(url);copied=true;}catch{}}
  button.removeAttribute('data-copying');button.textContent=copied?'✓ Copied':"Couldn’t copy";button.setAttribute('data-copied',String(copied));
  copyTimers.set(button,setTimeout(()=>{button.textContent=original;button.removeAttribute('data-copied');},1800));
 }
 function shareButton(sermon,seconds=0,clip=false){const button=document.createElement('button');button.type='button';button.className='share-button';button.textContent=clip?'Share clip':'Copy link';button.setAttribute('aria-live','polite');button.setAttribute('aria-label',clip?'Share clip from '+sermon.title+' at '+stamp(seconds):'Copy link to '+sermon.title);button.addEventListener('click',()=>share(button,sermon,seconds));return button;}
 async function context(sermon,excerpt){
  if(!docs.has(sermon.id))docs.set(sermon.id,fetch('/transcripts/'+encodeURIComponent(sermon.id)+'.json').then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).catch(error=>{docs.delete(sermon.id);throw error;}));
  const doc=await docs.get(sermon.id);if(doc.sourceAudio!==sermon.audio)throw Error('Recording changed');
  const segments=doc.segments||[];let i=segments.findIndex(s=>s.start>=excerpt.start-.1);if(i<0)i=0;
  return segments.slice(Math.max(0,i-1),i+6).map(s=>s.text).join(' ');
 }
 function excerptMore(block,sermon,excerpt,highlight){
  const button=document.createElement('button'),quote=block.querySelector('p');button.type='button';button.className='read-more';button.textContent='Read more';button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Read more from '+sermon.title+' at '+stamp(excerpt.start));let expanded=false,fullText=null,busy=false;
  function show(text,on){quote.textContent='“'+text+'”';highlight(quote);expanded=on;button.textContent=on?'Read less':'Read more';button.setAttribute('aria-expanded',String(on));}
  button.addEventListener('click',async()=>{if(busy)return;if(expanded){show(excerpt.text,false);return;}
   if(fullText===null){busy=true;button.textContent='Loading…';button.setAttribute('aria-busy','true');try{fullText=await context(sermon,excerpt);}catch{button.textContent='Try again';busy=false;button.removeAttribute('aria-busy');return;}busy=false;button.removeAttribute('aria-busy');}
   show(fullText,true);
  });block.append(button,shareButton(sermon,excerpt.start,true));
 }
 function loading(on){const panel=document.querySelector('.search-panel');panel?.setAttribute('data-searching',String(on));document.getElementById('results')?.setAttribute('aria-busy',String(on));}
 function closeMenus(except){document.querySelectorAll('.audio-options[open]').forEach(menu=>{if(menu!==except)menu.open=false;});}
 document.addEventListener('click',event=>{const menu=event.target.closest('.audio-options');if(!menu)closeMenus();else if(event.target.closest('summary'))closeMenus(menu);});
 document.addEventListener('toggle',event=>{if(event.target.matches('.audio-options')&&event.target.open)closeMenus(event.target);},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=document.querySelector('.audio-options[open]');if(menu){closeMenus();menu.querySelector('summary').focus();}}});
 const disclosure=document.querySelector('.filter-disclosure'),body=document.querySelector('.filters');
 if(disclosure&&body){let animation;disclosure.querySelector('summary').addEventListener('click',event=>{
  if(!matchMedia('(max-width:700px)').matches||reduced.matches)return;event.preventDefault();if(animation)return;
  const opening=!disclosure.open;if(opening)disclosure.open=true;disclosure.setAttribute('data-closing',String(!opening));
  const height=body.getBoundingClientRect().height;body.style.overflow='hidden';animation=body.animate(opening?[{height:'0px',opacity:0},{height:height+'px',opacity:1}]:[{height:height+'px',opacity:1},{height:'0px',opacity:0}],{duration:180,easing:'ease-out'});
  animation.finished.then(()=>{if(!opening)disclosure.open=false;disclosure.removeAttribute('data-closing');body.style.overflow='';animation=null;}).catch(()=>{animation=null;});
 });}
 if(audio){
  for(const event of ['timeupdate','durationchange'])audio.addEventListener(event,update);
  audio.addEventListener('play',()=>{if(!wantPlay)audio.pause();update();});
  audio.addEventListener('pause',()=>{if(audio.paused)wantPlay=false;update();});
  audio.addEventListener('ended',()=>{wantPlay=false;playRequest++;update();});
  audio.addEventListener('loadedmetadata',()=>{applySeek();update();});
  audio.addEventListener('error',()=>{if(current?.originalAudio?.startsWith('https://')&&audio.getAttribute('src')!==current.originalAudio){pendingSeek=pendingSeek??audio.currentTime;audio.src=current.originalAudio;if(wantPlay)play();}else{wantPlay=false;playRequest++;notice.textContent='Audio is unavailable. Try the sermon’s podcast links.';}update();});
  toggle.addEventListener('click',()=>{if(wantPlay)pause();else play();});
  document.getElementById('player-back').addEventListener('click',()=>{audio.currentTime=Math.max(0,audio.currentTime-15);update();});
  document.getElementById('player-forward').addEventListener('click',()=>{audio.currentTime=Math.min(Number.isFinite(audio.duration)?audio.duration:audio.currentTime+15,audio.currentTime+15);update();});
  seek.addEventListener('input',()=>{audio.currentTime=Number(seek.value);update();});
  document.getElementById('player-close').addEventListener('click',()=>{pause();player.hidden=true;document.body.classList.remove('has-player');const button=document.querySelector('.play[data-sermon-id="'+current?.id+'"]');button?.focus();});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(position).observe(player);
 }
 window.addEventListener('message',event=>{if(event.source!==window.parent||!['https://www.hinsonchurch.org','https://hinsonchurch.org'].includes(event.origin))return;const m=event.data;if(m?.type==='hinson-sermon-archive:viewport'&&Number.isFinite(m.top)&&Number.isFinite(m.bottom)){viewport=m;position();}});
 return {listen,bindPlay,shareButton,excerptMore,loading,update,shareUrl,stamp};
})();
