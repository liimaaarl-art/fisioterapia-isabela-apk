/* Relatórios clínicos: revisão legível, histórico e PDF local para compartilhar. */
(function(){
  'use strict';
  let report=null, generating=false;
  const fields=[
    ['Sinais vitais iniciais','vitalSignsInitial'],['Avaliação diária','dailyAssessment'],
    ['Objetivo','treatmentObjective'],['Conduta realizada','conductPerformed'],
    ['Sinais vitais finais','vitalSignsFinal'],['Observações','observation']
  ];
  const $=id=>document.getElementById(id);
  const safe=s=>esc(String(s??''));
  const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'');
  const selectedRecords=(patient,dates)=>(patient.evolucoes||[])
    .filter(e=>dates.includes(e.date)).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  function recordSnapshot(e){
    return {date:e.date,fields:fields.filter(([,key])=>String(e[key]||'').trim())
      .map(([label,key])=>({label,value:String(e[key]).trim()})),
      text:fields.some(([,key])=>String(e[key]||'').trim())?'':String(e.text||'').trim()};
  }
  function sourceText(patient,records,dates){
    const lines=[`Paciente: ${patient.name}`,`Datas selecionadas: ${dates.map(brDate).join(', ')}`];
    records.forEach(e=>{
      lines.push('',`ATENDIMENTO ${brDate(e.date)}`);
      for(const f of recordSnapshot(e).fields)lines.push(`${f.label}: ${f.value}`);
      if(!recordSnapshot(e).fields.length&&e.text)lines.push(`Registro: ${e.text}`);
    });
    return lines.join('\n');
  }
  function cleanText(value){
    return String(value||'').replace(/\r\n?/g,'\n').replace(/\*\*/g,'')
      .replace(/^\s*#{1,6}\s*/gm,'').replace(/^\s*---+\s*$/gm,'')
      .replace(/[ \t]+\|[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function contentLines(value){
    return cleanText(value).split('\n').map(s=>s.trim()).filter(Boolean)
      .filter(s=>!/^relat[oó]rio fisioterap[eê]utico(?:\s*[-–—:].*)?$/i.test(s))
      .filter(s=>!/^paciente:\s*.+$/i.test(s));
  }
  function lineHTML(raw){
    let line=raw.replace(/^[-•]\s*/,''),bullet=line!==raw;
    let heading=/^(?:\d{2}\/\d{2}\/\d{4}\b|[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s/()-]{4,})/.test(line)
      &&line.length<85&&!/:[^\s]/.test(line);
    if(heading)return `<h4>${safe(line)}</h4>`;
    const match=line.match(/^([^:]{2,38}):\s*(.*)$/);
    const html=match?`<strong>${safe(match[1])}:</strong> ${safe(match[2])}`:safe(line);
    return `<p${bullet?' class="clinical-bullet"':''}>${bullet?'• ':''}${html}</p>`;
  }
  function professional(patient){
    const p=professionalById(patient.professionalId)||professionals.find(x=>x.name==='Isabela Martins')||{};
    return {name:p.name||'Profissional não informado',registry:p.registry||''};
  }
  function reportFromPatient(patient,dates,format,text){
    const sorted=dates.slice().sort();
    return {patientId:patient.id,patientName:patient.name,dates:sorted,
      format,createdAt:new Date().toISOString(),professional:professional(patient),
      records:format==='extended'?selectedRecords(patient,sorted).map(recordSnapshot):[],text:cleanText(text)};
  }
  function documentHTML(doc){
    const dateList=doc.dates?.length?doc.dates.map(brDate).join(', '):'Não informado';
    const period=doc.dates?.length?`${brDate(doc.dates[0])} a ${brDate(doc.dates.at(-1))}`:'Não informado';
    const sections=contentLines(doc.text).map(lineHTML).join('')||'<p>Nenhum texto clínico informado.</p>';
    const records=(doc.records||[]).map((r,i)=>`<div class="clinical-visit"><h4>Atendimento ${i+1} · ${safe(brDate(r.date))}</h4>${r.fields.map(f=>`<p><strong>${safe(f.label)}:</strong> ${safe(f.value)}</p>`).join('')}${r.text?`<p>${safe(r.text)}</p>`:''}</div>`).join('');
    return `<article class="clinical-document"><header><div class="clinical-brand">IM · ISABELA MARTINS | FISIOTERAPIA</div><h2>Relatório fisioterapêutico</h2><p>${doc.format==='extended'?'Versão estendida':'Versão resumida'} · Emitido em ${safe(brDate((doc.createdAt||'').slice(0,10)))}</p></header><div class="clinical-meta"><div><span>Paciente</span><strong>${safe(doc.patientName)}</strong></div><div><span>Período selecionado</span><strong>${safe(period)}</strong></div><div class="clinical-meta-wide"><span>Datas incluídas</span><strong>${safe(dateList)}</strong></div></div><section><h3>Síntese do acompanhamento</h3>${sections}</section>${records?`<section><h3>Atendimentos selecionados</h3>${records}</section>`:''}<footer><b>${safe(doc.professional?.name||'Profissional não informado')}</b>${doc.professional?.registry?` · ${safe(doc.professional.registry)}`:''}<p>Revise o conteúdo clínico antes de compartilhar. Arquivo gerado pelo sistema, sem assinatura eletrônica.</p></footer></article>`;
  }
  function editor(){
    if($('clinicalReportModal'))return;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-back" id="clinicalReportModal"><div class="modal clinical-report-modal"><div class="modal-head"><h3>Relatório fisioterapêutico</h3><button type="button" class="btn tiny" onclick="closeModal('clinicalReportModal')">✕</button></div><div class="modal-body"><p class="clinical-help" id="clinicalReportHelp"></p><label class="clinical-edit-label" for="clinicalReportText">Texto clínico — revise e edite antes de enviar</label><textarea id="clinicalReportText" class="clinical-editor" oninput="updateClinicalReportPreview()"></textarea><p class="clinical-error hidden" id="clinicalReportError"></p><div class="clinical-preview-label">Prévia do documento</div><div id="clinicalReportPreview"></div></div><div class="modal-foot"><button type="button" class="btn" onclick="closeModal('clinicalReportModal')">Voltar</button><button type="button" class="btn green" id="clinicalSaveBtn" onclick="saveClinicalReport()">Salvar no prontuário</button><button type="button" class="btn primary" id="clinicalPdfBtn" onclick="downloadClinicalReport()">Baixar PDF</button><button type="button" class="btn" id="clinicalShareBtn" onclick="shareClinicalReport()">Compartilhar</button></div></div></div>`);
  }
  function updatePreview(){
    if(!report)return;
    report.text=cleanText($('clinicalReportText').value);
    $('clinicalReportPreview').innerHTML=documentHTML(report);
    for(const id of ['clinicalSaveBtn','clinicalPdfBtn','clinicalShareBtn'])$(id).disabled=generating||!report.text;
  }
  window.updateClinicalReportPreview=updatePreview;
  function showEditor(doc,error=''){
    report=doc;editor();$('clinicalReportHelp').textContent=doc.patientName+' · '+(doc.format==='extended'?'Estendida':'Resumida')+' · '+doc.dates.map(brDate).join(', ');
    $('clinicalReportText').value=doc.text;
    $('clinicalReportError').textContent=error;
    $('clinicalReportError').classList.toggle('hidden',!error);
    updatePreview();openModal('clinicalReportModal');
  }
  window.createSelectedDatesReport=async function(){
    if(generating)return;
    const patient=patientById(selectedPatientId);
    if(!patient)return;
    const dates=[...document.querySelectorAll('#selectedDatesReportList input:checked')].map(x=>x.value).filter(validDate).sort();
    if(!dates.length)return alert('Selecione ao menos uma data com evolução.');
    const format=$('selectedDatesReportFormat')?.value==='extended'?'extended':'summary';
    if(!confirm(`Enviar à IA somente as evoluções selecionadas de ${patient.name}? Revise o resultado antes de compartilhar.`))return;
    const records=selectedRecords(patient,dates),doc=reportFromPatient(patient,dates,format,'');
    closeModal('selectedDatesReportModal');generating=true;showEditor(doc);
    $('clinicalReportHelp').textContent='Gerando rascunho com IA…';
    try{
      const request=format==='extended'
        ?'Escreva uma síntese clínica clara do período, evolução funcional, resposta às condutas e orientações registradas. Os atendimentos datados serão anexados pelo sistema: evite repeti-los integralmente.'
        :'Escreva um resumo clínico legível do período, em parágrafos curtos com títulos claros: evolução, condutas, resposta e orientações, apenas quando esses dados constarem.';
      const response=await invokeIsabelaAI('report',`${request} Use somente os dados enviados. Não invente diagnóstico, sinais vitais, melhora, metas ou recomendações. Não use tabelas nem marcadores Markdown. Não inclua nome, título ou período: o sistema os exibirá.`,sourceText(patient,records,dates));
      if(report!==doc)return;
      doc.text=cleanText(response);showEditor(doc);
    }catch(error){
      if(report===doc)showEditor(doc,'Não foi possível gerar o texto agora: '+(error.message||error)+'. Tente novamente; nenhum relatório foi salvo.');
    }finally{generating=false;updatePreview();}
  };
  window.saveClinicalReport=async function(){
    if(!report?.text||generating)return;
    const p=patientById(report.patientId);if(!p)return alert('Paciente não encontrado.');
    const item={id:uid(),date:today(),title:`Relatório fisioterapêutico · ${report.format==='extended'?'estendido':'resumido'}`,text:report.text,reportMeta:JSON.parse(JSON.stringify(report)),attachments:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    p.relatorios=p.relatorios||[];p.relatorios.push(item);
    selectedPatientId=p.id;patientTab='relatorios';closeModal('clinicalReportModal');await persist();
  };
  function pdfText(s){
    let value=String(s||'').replace(/[\u0000-\u001F]/g,' ').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/•/g,'-').replace(/…/g,'...');
    return [...value].map(ch=>{try{pdfFont.encodeText(ch);return ch}catch{return '?'}}).join('');
  }
  let pdfFont;
  async function makePDF(doc){
    if(!window.PDFLib||!window.fontkit)throw Error('O recurso de PDF não carregou. Reabra o sistema com internet e tente novamente.');
    const {PDFDocument,rgb}=PDFLib,pdf=await PDFDocument.create();
    pdf.registerFontkit(window.fontkit);
    const fontData=await Promise.all(['report-font.ttf','report-font-bold.ttf'].map(async file=>{
      const response=await fetch(new URL(file,document.baseURI||location.href));
      if(!response.ok)throw Error('Não foi possível carregar a fonte do relatório.');
      return response.arrayBuffer();
    }));
    const normal=await pdf.embedFont(fontData[0],{subset:true}),bold=await pdf.embedFont(fontData[1],{subset:true});
    pdfFont=normal;
    const pw=595,ph=842,left=54,right=54,bottom=73,teal=rgb(.09,.35,.30),ink=rgb(.14,.19,.17),muted=rgb(.39,.44,.40),gold=rgb(.73,.58,.30);
    let page,y;
    function newPage(){page=pdf.addPage([pw,ph]);y=ph-61;page.drawText('IM  ISABELA MARTINS  |  FISIOTERAPIA',{x:left,y,size:10,font:bold,color:teal});y-=17;page.drawLine({start:{x:left,y},end:{x:pw-right,y},thickness:1,color:gold});y-=26;}
    function reserve(height){if(y-height<bottom)newPage();}
    function draw(s,size=10,font=normal,color=ink,indent=0){
      const limit=pw-left-right-indent;
      const words=[];
      for(const word of pdfText(s).split(/\s+/)){
        if(font.widthOfTextAtSize(word,size)<=limit){words.push(word);continue;}
        let part='';
        for(const char of word){
          if(font.widthOfTextAtSize(part+char,size)>limit&&part){words.push(part);part=char;}
          else part+=char;
        }
        if(part)words.push(part);
      }
      let line='';const lines=[];
      for(const w of words){const next=line?line+' '+w:w;if(font.widthOfTextAtSize(next,size)>limit&&line){lines.push(line);line=w;}else line=next;}
      if(line)lines.push(line);
      for(const l of lines){reserve(size*1.48);page.drawText(l,{x:left+indent,y,size,font,color});y-=size*1.48;}
      return lines.length;
    }
    function section(s){reserve(40);y-=15;draw(s,12,bold,teal);y-=8;}
    newPage();draw('RELATÓRIO FISIOTERAPÊUTICO',19,bold,ink);y-=7;
    draw(`${doc.format==='extended'?'Versão estendida':'Versão resumida'}  |  Emitido em ${brDate((doc.createdAt||'').slice(0,10))}`,9,normal,muted);y-=17;
    draw(`Paciente: ${doc.patientName}`,11,bold);y-=4;
    draw(`Período: ${doc.dates?.length?brDate(doc.dates[0])+' a '+brDate(doc.dates.at(-1)):'Não informado'}`,10);
    draw(`Datas incluídas: ${doc.dates?.length?doc.dates.map(brDate).join(', '):'Não informado'}`,9,normal,muted);
    section('SÍNTESE DO ACOMPANHAMENTO');
    for(const line of contentLines(doc.text)){
      if(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s/()-]{4,}$/.test(line)&&line.length<85){reserve(29);y-=8;draw(line,11,bold,teal);}
      else {draw(line.replace(/^[-•]\s*/,''),11);y-=6;}
    }
    if(doc.records?.length){section('ATENDIMENTOS SELECIONADOS');for(const [i,r] of doc.records.entries()){
      reserve(54);y-=8;draw(`Atendimento ${i+1} - ${brDate(r.date)}`,11,bold,teal);
      for(const f of r.fields)draw(`${f.label}: ${f.value}`,10);
      if(r.text)draw(r.text,10);y-=9;
    }}
    section('IDENTIFICAÇÃO PROFISSIONAL');
    draw(`${doc.professional?.name||'Profissional não informado'}${doc.professional?.registry?' - '+doc.professional.registry:''}`,10,bold);
    y-=7;draw('Arquivo gerado pelo sistema, sem assinatura eletrônica. Revise antes de compartilhar.',8,normal,muted);
    const pages=pdf.getPages();pages.forEach((p,i)=>{
      p.drawLine({start:{x:left,y:52},end:{x:pw-right,y:52},thickness:.5,color:gold});
      p.drawText('Isabela Martins | Fisioterapia',{x:left,y:35,size:8,font:normal,color:muted});
      p.drawText(`${i+1} / ${pages.length}`,{x:pw-right-30,y:35,size:8,font:normal,color:muted});
    });
    return new Blob([await pdf.save()],{type:'application/pdf'});
  }
  function fileName(doc){return `relatorio-${(doc.patientName||'paciente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${(doc.createdAt||today()).slice(0,10)}.pdf`}
  async function exportPDF(doc,share=false){
    try{
      const blob=await makePDF(doc),name=fileName(doc);
      if(share&&navigator.share){
        const file=new File([blob],name,{type:'application/pdf'});
        if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Relatório fisioterapêutico'});return;}
      }
      downloadBlob(blob,name);
      if(share)alert('PDF baixado. Abra o arquivo e compartilhe pelo aplicativo de sua preferência.');
    }catch(e){if(e.name!=='AbortError')alert('Não foi possível preparar o PDF: '+(e.message||e));}
  }
  window.downloadClinicalReport=()=>report?.text&&exportPDF(report);
  window.shareClinicalReport=()=>report?.text&&exportPDF(report,true);
  window.downloadSavedClinicalReport=(patientId,entryId)=>{
    const p=patientById(patientId),e=(p?.relatorios||[]).find(x=>x.id===entryId);
    if(!e)return;
    const doc=e.reportMeta?{...e.reportMeta,text:e.text,patientName:p.name}:{patientId,patientName:p.name,dates:[],format:'summary',createdAt:e.createdAt||e.date,professional:professional(p),records:[],text:e.text||''};
    return exportPDF(doc);
  };
  const previousEntry=entryHTML;
  entryHTML=function(p,type,e){
    if(type!=='relatorios')return previousEntry(p,type,e);
    const doc=e.reportMeta?{...e.reportMeta,text:e.text,patientName:p.name}:{patientName:p.name,dates:[],format:'summary',createdAt:e.createdAt||e.date,professional:professional(p),records:[],text:e.text||''};
    const visible=contentLines(doc.text).slice(0,5).map(lineHTML).join('');
    const count=contentLines(doc.text).length;
    const attachments=(e.attachments||[]).map(a=>`<button class="attachment" onclick="openAttachment('${p.id}','relatorios','${e.id}','${a.id}')">📎 ${safe(a.name)}</button>`).join('');
    return `<div class="entry clinical-entry"><div class="entry-head"><div><h4>${safe(e.title||'Relatório fisioterapêutico')}</h4><small>${safe(brDate(e.date))}${e.reportMeta?.dates?.length?' · '+e.reportMeta.dates.length+' data(s) selecionada(s)':''}</small></div><div class="clinical-entry-actions"><button class="btn tiny primary" onclick="downloadSavedClinicalReport('${p.id}','${e.id}')">Baixar PDF</button><button class="btn tiny" onclick="openEntryModal('relatorios','${e.id}')">Editar</button><button class="btn tiny red" onclick="deleteEntry('relatorios','${e.id}')">Excluir</button></div></div><div class="clinical-entry-body">${visible}${count>5?`<p class="helper">+ ${count-5} linha(s) no relatório completo</p>`:''}</div><details class="clinical-full"><summary>Ver relatório completo</summary>${documentHTML(doc)}</details>${attachments?`<div class="attachments">${attachments}</div>`:''}</div>`;
  };
  window.entryHTML=entryHTML;
  if(typeof module!=='undefined'&&module.exports)module.exports={cleanText,contentLines,selectedRecords,recordSnapshot};
})();
