(function () {
  var frame = document.getElementById('hinson-sermon-archive');
  window.addEventListener('message', function (event) {
    if (event.origin !== 'https://hinson-sermon-archive.grahamark4.workers.dev' ||
        event.source !== frame.contentWindow) return;
    var message = event.data;
    if (!message || message.type !== 'hinson-sermon-archive:resize' ||
        typeof message.height !== 'number' || !Number.isFinite(message.height) ||
        message.height <= 0) return;
    frame.style.height = Math.ceil(message.height) + 'px';
  });
})();