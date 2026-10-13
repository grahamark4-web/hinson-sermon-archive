(function () {
  var frame = document.getElementById('hinson-sermon-archive');
  if (!frame) return;
  // Forward only sermon sharing parameters from the church page into the archive.
  var shared = new URLSearchParams(window.location.search), sermon = shared.get('sermon');
  if (sermon && /^[a-zA-Z0-9_-]+$/.test(sermon)) {
    var target = new URL(frame.src), seconds = Number(shared.get('t'));
    if (target.origin === 'https://hinson-sermon-archive.grahamark4.workers.dev') {
      target.searchParams.set('sermon',sermon);target.searchParams.delete('t');
      if (Number.isFinite(seconds) && seconds > 0) target.searchParams.set('t',String(Math.floor(seconds)));
      frame.src = target.href;
    }
  }
  var origin = 'https://hinson-sermon-archive.grahamark4.workers.dev', pending = false;
  frame.style.width = '100%';frame.style.border = '0';frame.style.display = 'block';frame.style.overflow = 'hidden';frame.style.height = '1100px';
  function reportViewport() {
    if(sermon&&/^[a-zA-Z0-9_-]+$/.test(sermon))frame.contentWindow.postMessage({type:'hinson-sermon-archive:share',sermon:sermon,t:Number(shared.get('t'))||0},origin);
    pending = false;var rect = frame.getBoundingClientRect();
    frame.contentWindow.postMessage({type:'hinson-sermon-archive:viewport',top:Math.max(0,-rect.top),bottom:Math.min(rect.height,window.innerHeight-rect.top)},origin);
  }
  function queueViewport(){if(!pending){pending=true;requestAnimationFrame(reportViewport);}}
  window.addEventListener('message', function(event) {
    if(event.origin!==origin||event.source!==frame.contentWindow)return;
    var message=event.data;
    if(!message||message.type!=='hinson-sermon-archive:resize'||typeof message.height!=='number'||!Number.isFinite(message.height)||message.height<=0)return;
    frame.style.height=Math.ceil(message.height)+'px';queueViewport();
  });
  window.addEventListener('scroll',queueViewport,{passive:true,capture:true});
  window.addEventListener('resize',queueViewport,{passive:true});
  frame.addEventListener('load',queueViewport);queueViewport();
})();
