/* v37: visualizacao por data do texto gerado pela IA e exportacao local por impressao/PDF. */
(function () {
  'use strict';
  var original = window.openAITextModal;
  if (typeof original !== 'function') return;

  var modal = document.getElementById('aiModal');
  var content = document.getElementById('aiModalText');
  var saveButton = document.getElementById('aiModalSaveBtn');
  if (!modal || !content || !saveButton) return;
  var lastText = '', lastTitle = '', isReport = false;

  function normalize(raw) {
    return String(raw == null ? '' : raw)
      .replace(/\r\n?/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(?:p|div|li|ul|strong|b)>/gi, '\n')
      .replace(/^\s*\|?\s*Data\s*\|[^\n]*$/gmi, '')
      .replace(/^\s*\|?\s*[-:|\s]{8,}\|?\s*$/gm, '')
      .replace(/\|\s*\*{0,2}(\d{2}\/\d{2}\/\d{4})\*{0,2}\s*\|/g, '\n\nATENDIMENTO — $1\n')
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/[ \t]*\|[ \t]*/g, '\n')
      .replace(/\n[ \t]+\n/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  function element(tag, text, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function readableView(text) {
    content.textContent = '';
    content.classList.add('is37-preview');
    var section = null, paragraphs = 0;
    text.split('\n').forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) { paragraphs = 0; return; }
      var date = line.match(/^(?:ATENDIMENTO(?:\s*[—:-]\s*|\s+)|DATA\s*[:—-]\s*)(\d{2}\/\d{2}\/\d{4})(?:\s*.*)?$/i);
      if (!date && /^\d{2}\/\d{2}\/\d{4}$/.test(line)) date = [line, line];
      if (date) {
        section = element('section', '', 'is37-day');
        section.appendChild(element('h4', 'Atendimento — ' + date[1], 'is37-day-title'));
        content.appendChild(section);
        paragraphs = 0;
        return;
      }
      if (!section) {
        section = element('section', '', 'is37-intro');
        content.appendChild(section);
      }
      var bullet = /^(?:[•\-*]\s+)/.test(line);
      var heading = /^(?:sinais vitais|avaliação|objetivos?|condutas?|observações?|respostas?|evolução|ausências?)\b/i.test(line);
      var node = element('p', line, bullet ? 'is37-bullet' : (heading ? 'is37-field' : 'is37-line'));
      if (paragraphs === 0) node.classList.add('is37-group-start');
      section.appendChild(node);
      paragraphs++;
    });
  }

  var css = document.createElement('style');
  css.textContent =
    '.ai-modal-text.is37-preview{white-space:normal;font-size:13px;line-height:1.6;padding:18px}' +
    '.is37-preview .is37-day{background:#fff;border:1px solid #e0e9df;border-left:4px solid #80a48a;border-radius:10px;padding:14px 15px;margin:15px 0;break-inside:avoid-page}' +
    '.is37-preview .is37-intro{margin:0 0 18px}' +
    '.is37-preview .is37-day-title{font-size:15px;margin:0 0 12px;color:#2c6249}' +
    '.is37-preview p{margin:0 0 8px;overflow-wrap:anywhere}' +
    '.is37-preview p.is37-field{font-weight:650;margin-top:11px}' +
    '.is37-preview p.is37-bullet{padding-left:14px;text-indent:-12px}' +
    '.is37-preview p.is37-group-start{margin-top:13px}' +
    '@media print{.is37-preview .is37-day{break-inside:auto}}';
  document.head.appendChild(css);

  var pdfButton = document.createElement('button');
  pdfButton.type = 'button';
  pdfButton.className = 'btn hidden';
  pdfButton.id = 'is37PdfButton';
  pdfButton.textContent = '📄 Salvar como PDF';
  saveButton.parentNode.insertBefore(pdfButton, saveButton);

  function safe(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  pdfButton.addEventListener('click', function () {
    if (!isReport || !lastText) return;
    // Usa a impressao nativa: o paciente nao e enviado a conversores externos.
    var w = window.open('', '_blank');
    if (!w) return alert('Permita janelas de impressao no navegador para salvar como PDF.');
    var head = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + safe(lastTitle) + '</title>' +
      '<style>@page{size:A4;margin:18mm}body{font:11pt/1.6 Arial,sans-serif;color:#293c31}h1{font-size:18pt;color:#2c6249;border-bottom:2px solid #7ca488;padding-bottom:12px}' +
      '.is37-day{border-left:3px solid #7ca488;padding:9px 0 7px 15px;margin:18px 0;page-break-inside:avoid}.is37-day-title{font-size:12pt;color:#2c6249;margin:0 0 10px}' +
      'p{margin:0 0 7px;overflow-wrap:anywhere}.is37-field{font-weight:bold;margin-top:11px}.is37-bullet{margin-left:14px}' +
      'footer{border-top:1px solid #ddd;font-size:9pt;color:#63736a;margin-top:26px;padding-top:10px}@media screen{body{max-width:800px;margin:25px auto;padding:20px}}</style></head><body><h1>' +
      safe(lastTitle) + '</h1>';
    w.document.open();
    w.document.write(head + content.innerHTML +
      '<footer>Documento gerado a partir dos registros selecionados. Revisar e validar antes de assinar ou compartilhar.</footer></body></html>');
    w.document.close();
    w.focus();
    w.setTimeout(function () { w.print(); }, 400);
  });

  window.openAITextModal = function (title, text, options) {
    isReport = !!(options && options.saveReport);
    lastTitle = String(title || 'Relatório fisioterapêutico');
    lastText = isReport ? normalize(text) : '';
    original.call(this, title, isReport ? lastText : text, options);
    pdfButton.classList.toggle('hidden', !isReport);
    if (isReport) readableView(lastText);
    else content.classList.remove('is37-preview');
  };

  // Para testes de formatacao sem dados de pacientes.
  if (typeof module !== 'undefined' && module.exports) module.exports = { normalize: normalize };
})();