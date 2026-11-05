
/* Isabela Martins v36: relatórios clínicos por atendimento, sem alterar o banco. */
(function () {
  'use strict';
  var activePatientId = '';
  var saving = false;
  var el = function (id) { return document.getElementById(id); };
  var html = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  };
  var dateLabel = function (v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return String(v || '');
    return v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4);
  };
  var patient = function () { return patients.find(function (p) { return p.id === activePatientId; }); };
  var getRows = function (p) {
    var map = new Map();
    var todayValue = dateStr(new Date());
    function row(date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || date > todayValue) return null;
      if (!map.has(date)) map.set(date, {date: date, visits: [], evolutions: []});
      return map.get(date);
    }
    appointments.filter(function (a) {
      return a.patientId === p.id && a.status === 'Realizado';
    }).forEach(function (a) {
      var r = row(a.date);
      if (r) r.visits.push(a);
    });
    (p.evolucoes || []).forEach(function (e) {
      var r = row(e.date);
      if (r) r.evolutions.push(e);
    });
    return Array.from(map.values()).sort(function (a, b) { return b.date.localeCompare(a.date); });
  };
  var normalText = function (v) { return String(v == null ? '' : v).trim(); };
  // Converte quebras HTML e tabelas em texto clínico legível sem interpretar HTML.
  var cleanClinicalText = function (v) {
    return normalText(v).replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(?:p|div|li|ul|strong|b)>/gi, '\n')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .split('\n').filter(function (line) {
        return !/^\s*\|?\s*(?:Data\s*\||[-:|\s]{8,})\s*$/i.test(line);
      }).join('\n')
      .replace(/[ \t]*\|[ \t]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n').trim();
  };
  var sectionText = function (r) {
    var entries = [];
    r.evolutions.forEach(function (e) {
      var fields = [
        ['Sinais vitais iniciais', e.vitalSignsInitial],
        ['Avaliação do dia', e.dailyAssessment || e.text],
        ['Objetivo terapêutico', e.treatmentObjective],
        ['Conduta realizada', e.conductPerformed],
        ['Sinais vitais finais', e.vitalSignsFinal],
        ['Observações', e.observation]
      ].filter(function (x) { return cleanClinicalText(x[1]); });
      entries.push(fields.map(function (x) { return '• ' + x[0] + ':\n' + cleanClinicalText(x[1]); }).join('\n\n') || 'Evolução registrada sem descrição textual.');
    });
    if (!entries.length) entries.push('Atendimento realizado, sem evolução clínica textual registrada para esta data.');
    return entries.join('\n\n');
  };
  var selectedRows = function () {
    var p = patient();
    if (!p) return [];
    var checked = Array.from(el('is36Dates').querySelectorAll('input[type=checkbox]:checked')).map(function (x) { return x.value; });
    return getRows(p).filter(function (r) { return checked.indexOf(r.date) !== -1; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
  };
  var makeModel = function () {
    var p = patient();
    var rows = selectedRows();
    if (!p || !rows.length) { alert('Selecione pelo menos uma data de atendimento.'); return null; }
    var pro = professionals.find(function (x) { return x.id === p.professionalId; }) || professionals.find(function (x) { return x.name === 'Isabela Martins'; }) || {};
    return {
      version: 36,
      title: normalText(el('is36Title').value) || 'Relatório fisioterapêutico',
      patientName: normalText(p.name),
      professional: normalText(pro.name) || 'Isabela Martins',
      registry: normalText(pro.registry) || 'CREFITO 3 346081-F',
      issueDate: new Date().toLocaleDateString('pt-BR'),
      purpose: cleanClinicalText(el('is36Purpose').value),
      context: cleanClinicalText(el('is36Context').value),
      summary: cleanClinicalText(el('is36Summary').value),
      conclusion: cleanClinicalText(el('is36Conclusion').value),
      sessions: rows.map(function (r) {
        return {date: r.date, count: r.visits.length, text: sectionText(r)};
      })
    };
  };
  var asPlainText = function (m) {
    var parts = [
      m.title.toUpperCase(),
      'Paciente: ' + m.patientName,
      'Profissional: ' + m.professional + ' — ' + m.registry,
      'Data de emissão: ' + m.issueDate,
      'Período selecionado: ' + dateLabel(m.sessions[0].date) + ' a ' + dateLabel(m.sessions[m.sessions.length - 1].date),
      'Datas incluídas: ' + m.sessions.length
    ];
    if (m.purpose) parts.push('', 'FINALIDADE', m.purpose);
    if (m.context) parts.push('', 'CONTEXTO CLÍNICO REGISTRADO', m.context);
    if (m.summary) parts.push('', 'SÍNTESE DO ACOMPANHAMENTO', m.summary);
    parts.push('', 'ATENDIMENTOS SELECIONADOS');
    m.sessions.forEach(function (s) { parts.push('', dateLabel(s.date), s.text); });
    if (m.conclusion) parts.push('', 'CONCLUSÃO / RECOMENDAÇÕES DA PROFISSIONAL', m.conclusion);
    parts.push('', 'Documento elaborado a partir dos registros selecionados e sujeito à revisão e validação da profissional responsável.');
    return parts.join('\n');
  };
  function buildHTML(m) {
    var paragraph = function (s) { return html(s).replace(/\n/g, '<br>'); };
    var section = function (title, s) {
      return s ? '<section class="block"><h2>' + html(title) + '</h2><p>' + paragraph(s) + '</p></section>' : '';
    };
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + html(m.title) + '</title><style>' +
      '@page{size:A4;margin:18mm 17mm 19mm}*{box-sizing:border-box}body{font:11pt/1.55 Arial,sans-serif;color:#26362e;margin:0;background:#fff}header{border-bottom:2px solid #648574;padding-bottom:15px;margin-bottom:22px}.brand{color:#42725b;font-weight:700;font-size:11pt;letter-spacing:.06em}h1{font:700 20pt/1.2 Georgia,serif;color:#264b3a;margin:9px 0 6px}.subtitle{color:#607467;font-size:9pt}dl{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin:12px 0 16px;padding:12px;background:#f3f7f3;border:1px solid #dae6da;border-radius:8px}dt{font-size:8pt;color:#61776a;text-transform:uppercase;letter-spacing:.04em}dd{margin:2px 0 0;font-weight:600}h2{font-size:11pt;color:#366449;margin:0 0 7px;text-transform:uppercase;letter-spacing:.035em;border-bottom:1px solid #dce5dd;padding-bottom:4px}.block{margin:16px 0}.block p{white-space:normal;margin:0}.visit{margin:0 0 15px;border-left:3px solid #8caf94;padding:4px 0 4px 13px;break-inside:avoid-page}.visit h3{font-size:10.5pt;margin:0 0 5px}.visit p{margin:0;overflow-wrap:anywhere}.note{font-size:8.5pt;color:#738176;border-top:1px solid #e0e8e1;margin-top:28px;padding-top:9px}.sign{margin-top:44px;width:64%;border-top:1px solid #5c7564;padding-top:8px;break-inside:avoid-page;font-size:10pt}.sign small{display:block;color:#5a6c60} @media screen{body{max-width:820px;margin:28px auto;padding:32px;box-shadow:0 0 18px #d9e0d9}}' +
      '</style></head><body><header><div class="brand">ISABELA MARTINS · FISIOTERAPIA</div><h1>' + html(m.title) + '</h1><div class="subtitle">Documento clínico para revisão da profissional responsável</div></header>' +
      '<dl><div><dt>Paciente</dt><dd>' + html(m.patientName) + '</dd></div><div><dt>Data de emissão</dt><dd>' + html(m.issueDate) + '</dd></div><div><dt>Profissional</dt><dd>' + html(m.professional) + '</dd></div><div><dt>Registro</dt><dd>' + html(m.registry) + '</dd></div><div><dt>Período contemplado</dt><dd>' + html(dateLabel(m.sessions[0].date) + ' a ' + dateLabel(m.sessions[m.sessions.length - 1].date)) + '</dd></div><div><dt>Datas incluídas</dt><dd>' + m.sessions.length + '</dd></div></dl>' +
      section('Finalidade', m.purpose) + section('Contexto clínico registrado', m.context) + section('Síntese do acompanhamento', m.summary) +
      '<section class="block"><h2>Registros dos atendimentos selecionados</h2>' + m.sessions.map(function (s) { return '<div class="visit"><h3>' + html(dateLabel(s.date)) + '</h3><p>' + paragraph(s.text) + '</p></div>'; }).join('') + '</section>' +
      section('Conclusão e recomendações', m.conclusion) + '<div class="sign">' + html(m.professional) + '<small>' + html(m.registry) + '</small></div>' +
      '<p class="note">As informações deste documento correspondem aos registros das datas selecionadas. Conferir e validar antes de assinar ou compartilhar.</p></body></html>';
  }
  function printModel(m) {
    var win = window.open('', '_blank');
    if (!win) { alert('O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.'); return; }
    win.document.open();
    win.document.write(buildHTML(m));
    win.document.close();
    win.focus();
    win.setTimeout(function () { win.print(); }, 400);
  }
  function showSelection() {
    var p = patient();
    if (!p) return;
    var rows = getRows(p);
    el('is36Dates').innerHTML = rows.length ? rows.map(function (r) {
      return '<label class="is36-date"><input type="checkbox" value="' + html(r.date) + '"><span><strong>' + html(dateLabel(r.date)) + '</strong><small>' + r.visits.length + ' atendimento(s) realizado(s) · ' + r.evolutions.length + ' evolução(ões)</small></span></label>';
    }).join('') : '<p class="helper">Não há atendimentos realizados nem evoluções com data para este paciente.</p>';
    refreshCount();
  }
  function refreshCount() {
    var count = selectedRows().length;
    el('is36Count').textContent = count + (count === 1 ? ' data selecionada' : ' datas selecionadas');
  }
  function openComposer(id) {
    activePatientId = id;
    var p = patient();
    if (!p) return;
    el('is36Patient').textContent = p.name;
    el('is36Title').value = 'Relatório fisioterapêutico';
    el('is36Purpose').value = '';
    el('is36Context').value = normalText(p.initial);
    el('is36Summary').value = '';
    el('is36Conclusion').value = '';
    el('is36Message').textContent = 'Selecione somente as datas que devem constar no relatório.';
    showSelection();
    openModal('reportComposerV36');
  }
  async function aiSummary() {
    var rows = selectedRows(), p = patient();
    if (!p || !rows.length) return alert('Selecione as datas antes de pedir a síntese à IA.');
    if (!confirm('Enviar à IA os registros clínicos APENAS das datas selecionadas de ' + p.name + '? O resultado é um rascunho que exige revisão.')) return;
    var button = el('is36AI');
    button.disabled = true;
    button.textContent = 'Gerando síntese…';
    try {
      var context = rows.map(function (r) { return dateLabel(r.date) + '\n' + sectionText(r); }).join('\n\n');
      var result = await invokeIsabelaAI('report', 'Elabore SOMENTE a síntese clínica dos atendimentos selecionados, em português, separada por DATA, em ordem cronológica. Para CADA data presente nos registros, use um título em linha própria: ATENDIMENTO — DD/MM/AAAA. Abaixo, escreva tópicos objetivos, cada um em linha distinta: • Avaliação; • Objetivos; • Condutas; • Resposta observada; • Observações. Inclua apenas tópicos que tenham informação registrada. Separe os dias com uma linha vazia. Não use tabelas, barras verticais, HTML, <br> nem markdown de tabela. Não acrescente diagnósticos, datas, procedimentos, sinais vitais, resultados ou conclusões que não constem dos registros. Não misture atendimentos de dias diferentes.', context);
      if (activePatientId === p.id && el('reportComposerV36').classList.contains('show')) el('is36Summary').value = cleanClinicalText(result);
    } catch (e) {
      alert('Não foi possível gerar a síntese por IA. O preenchimento manual continua disponível. ' + (e.message || ''));
    } finally {
      button.disabled = false;
      button.textContent = '✨ Organizar síntese por data com IA';
    }
  }
  async function saveReport() {
    if (saving) return;
    var m = makeModel(), p = patient();
    if (!m || !p) return;
    var backup = (p.relatorios || []).slice();
    var now = new Date().toISOString();
    var entry = {id: uid(), date: new Date().toISOString().slice(0, 10), title: m.title, text: asPlainText(m), reportModel: m, reportDates: m.sessions.map(function (s) { return s.date; }), attachments: [], createdAt: now, updatedAt: now};
    saving = true;
    el('is36Save').disabled = true;
    try {
      p.relatorios = backup.concat([entry]);
      await persist(true);
      var synced = storageMode === 'supabase' && cloudReady;
      closeModal('reportComposerV36');
      selectedPatientId = p.id;
      patientTab = 'relatorios';
      render();
      alert(synced ? 'Relatório salvo. Confira a versão no prontuário.' : 'Relatório guardado localmente, mas a confirmação de sincronização com a nuvem está pendente. Confira o indicador antes de usar outro aparelho.');
    } catch (e) {
      p.relatorios = backup;
      alert('Não foi possível salvar o relatório: ' + (e.message || e));
    } finally {
      saving = false;
      el('is36Save').disabled = false;
    }
  }
  function addPrintButtons() {
    if (patientTab !== 'relatorios' || !selectedPatientId) return;
    var p = patients.find(function (x) { return x.id === selectedPatientId; });
    if (!p) return;
    var entries = (p.relatorios || []).slice().sort(function (a,b) { return (b.date || '').localeCompare(a.date || ''); });
    var cards = Array.from(document.querySelectorAll('#main .entry'));
    cards.forEach(function (card, i) {
      var e = entries[i];
      if (!e || !e.reportModel || !Array.isArray(e.reportModel.sessions) || !e.reportModel.sessions.length) return;
      var actions = card.querySelector('.entry-head > div:last-child');
      if (!actions || actions.querySelector('.is36-print-saved')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn tiny is36-print-saved';
      btn.textContent = 'Imprimir / PDF';
      btn.addEventListener('click', function () { printModel(e.reportModel); });
      actions.insertBefore(btn, actions.firstChild);
    });
  }
  var style = document.createElement('style');
  style.textContent = '.is36-modal{max-width:940px!important;width:95vw!important}.is36-intro{color:#52675b;margin:0 0 12px}.is36-section{border:1px solid #e2ebe2;border-radius:10px;padding:14px;margin:12px 0}.is36-section h4{margin:0 0 8px;color:#355a46}.is36-dates{max-height:225px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:8px}.is36-date{display:flex;gap:10px;align-items:center;border:1px solid #dbe6db;border-radius:8px;padding:10px;cursor:pointer;background:#f9fbf8}.is36-date input{width:18px;height:18px;flex-shrink:0}.is36-date strong{display:block}.is36-date small{display:block;color:#66786a;font-size:11px;margin-top:3px}.is36-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.is36-grid label{display:block;font-weight:600;margin:4px 0 6px}.is36-grid input,.is36-grid textarea{width:100%}.is36-grid .wide{grid-column:1/-1}.is36-grid textarea{min-height:95px}.is36-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.is36-helper{font-size:12px;color:#587261;margin:8px 0}.is36-cta{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.is36-cta button{font-size:12px}@media(max-width:650px){.is36-grid{grid-template-columns:1fr}.is36-modal{width:98vw!important}.is36-dates{grid-template-columns:1fr}}';
  document.head.appendChild(style);
  var modal = document.createElement('div');
  modal.className = 'modal-back';
  modal.id = 'reportComposerV36';
  modal.innerHTML = [
    '<div class="modal is36-modal"><div class="modal-head"><h3>Relatório fisioterapêutico · <span id="is36Patient"></span></h3><button type="button" class="btn tiny" id="is36CloseTop">✕</button></div>',
    '<div class="modal-body"><p class="is36-intro">Escolha os atendimentos, revise o conteúdo e salve ou imprima em PDF. O sistema não acrescenta dados clínicos que não foram registrados.</p>',
    '<div class="is36-section"><h4>1. Escolha as datas</h4><div class="is36-cta"><button class="btn tiny" type="button" id="is36SelectAll">Selecionar todas</button><button class="btn tiny" type="button" id="is36Clear">Limpar</button><strong id="is36Count"></strong></div><div class="is36-dates" id="is36Dates"></div></div>',
    '<div class="is36-section"><h4>2. Revise os dados do documento</h4><div class="is36-grid"><div class="wide"><label for="is36Title">Título</label><input id="is36Title"></div><div><label for="is36Purpose">Finalidade (opcional)</label><textarea id="is36Purpose" placeholder="Ex.: acompanhamento funcional"></textarea></div><div><label for="is36Context">Contexto inicial (editável)</label><textarea id="is36Context"></textarea></div><div class="wide"><label for="is36Summary">Síntese do acompanhamento</label><textarea id="is36Summary" placeholder="Resumo clínico revisado pela profissional."></textarea><button class="btn ai-dark" type="button" id="is36AI">✨ Organizar síntese por data com IA</button></div><div class="wide"><label for="is36Conclusion">Conclusão e recomendações (opcional)</label><textarea id="is36Conclusion" placeholder="Preenchimento e validação da fisioterapeuta."></textarea></div></div><p class="is36-helper">O PDF também incluirá somente as evoluções das datas marcadas acima.</p></div>',
    '<p class="is36-helper" id="is36Message"></p><p class="is36-helper">Para baixar: toque em “Salvar como PDF / imprimir” e escolha “Salvar como PDF” no navegador ou celular.</p></div>',
    '<div class="modal-foot is36-foot"><button class="btn" id="is36Cancel" type="button">Cancelar</button><button class="btn" id="is36Print" type="button">📄 Salvar como PDF / imprimir</button><button class="btn primary" id="is36Save" type="button">💾 Salvar no prontuário</button></div></div>'
  ].join('');
  document.body.appendChild(modal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal('reportComposerV36'); });
  el('is36CloseTop').addEventListener('click', function () { closeModal('reportComposerV36'); });
  el('is36Cancel').addEventListener('click', function () { closeModal('reportComposerV36'); });
  el('is36SelectAll').addEventListener('click', function () { el('is36Dates').querySelectorAll('input').forEach(function (c) { c.checked = true; }); refreshCount(); });
  el('is36Clear').addEventListener('click', function () { el('is36Dates').querySelectorAll('input').forEach(function (c) { c.checked = false; }); refreshCount(); });
  el('is36Dates').addEventListener('change', refreshCount);
  el('is36AI').addEventListener('click', aiSummary);
  el('is36Print').addEventListener('click', function () { var m = makeModel(); if (m) printModel(m); });
  el('is36Save').addEventListener('click', saveReport);
  generatePatientAIReport = function (id) { openComposer(id); };
  var previousRenderPatientDetail = renderPatientDetail;
  renderPatientDetail = function () { previousRenderPatientDetail.apply(this, arguments); addPrintButtons(); };
})();
