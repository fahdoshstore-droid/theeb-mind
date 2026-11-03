// ADA2AI brand mark — paths copied verbatim from ada2ai/src/components/AdaLogo.tsx
// Usage: <span data-logo="mark,bolt,text,two" data-size="28"></span>
// mark may be "grad" to use the original teal→scout-blue gradient.
(function () {
  var M = 'M50 5 L85 25 L85 65 L50 95 L15 75 L15 25 L50 5 L50 18 L28 30 L28 70 L50 82 L72 70 L72 35 L60 45 L50 35 L65 15 L50 5 Z';
  var B = 'M48 20 L68 20 L45 50 L65 50 L35 85 L48 45 L32 45 Z';
  var n = 0;
  document.querySelectorAll('[data-logo]').forEach(function (el) {
    var p = el.dataset.logo.split(',');
    var size = +(el.dataset.size || 28);
    var id = 'adag' + (n++);
    var fill = p[0] === 'grad' ? 'url(#' + id + ')' : p[0];
    var wordmark = el.dataset.mark === 'only' ? '' :
      '<span style="font-family:Orbitron,system-ui,sans-serif;font-weight:900;font-size:' + (size * 0.72) +
      'px;letter-spacing:-0.04em;line-height:1;direction:ltr;display:inline-flex;color:' + p[2] + '">Ada<span style="color:' + p[3] + '">2</span>AI</span>';
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.gap = (size * 0.32) + 'px';
    el.style.direction = 'ltr';
    el.innerHTML =
      '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00DCC8"/><stop offset="100%" stop-color="#007ABA"/></linearGradient></defs>' +
      '<path d="' + M + '" fill="' + fill + '" fill-rule="evenodd"/><path d="' + B + '" fill="' + p[1] + '"/></svg>' + wordmark;
  });
})();
