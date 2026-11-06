const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');

const elements=new Map();
const el=id=>{
  if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',innerHTML:'',disabled:false,
    classList:{add(){},remove(){},toggle(){},contains(){return true}}});
  return elements.get(id);
};
el('selectedDatesReportFormat').value='extended';
const patient={id:'p1',name:'Paciente Fictícia',professionalId:'pr1',relatorios:[],evolucoes:[
  {date:'2026-10-07',dailyAssessment:'Mobilidade supervisionada.',conductPerformed:'Treino de equilíbrio.'},
  {date:'2026-10-10',dailyAssessment:'DADO NÃO SELECIONADO'}]};
const ctx={console,Blob,File,Date,Promise,URL,setTimeout,clearTimeout,patients:[patient],selectedPatientId:'p1',patientTab:'relatorios',
  professionals:[{id:'pr1',name:'Fisioterapeuta Teste',registry:'CREFITO Teste'}],
  document:{baseURI:'https://example.test/',getElementById:el,body:{insertAdjacentHTML(_position,markup){for(const match of markup.matchAll(/id="([^"]+)"/g))el(match[1]);}},querySelectorAll(selector){return selector==='#selectedDatesReportList input:checked'?[{value:'2026-10-07'}]:[];}},
  fetch:async url=>({ok:true,arrayBuffer:async()=>new ctx.VMUint8Array(fs.readFileSync(path.join(__dirname,'..',new URL(url).pathname))).buffer}),
  patientById(id){return id==='p1'?patient:null;},professionalById(id){return ctx.professionals.find(p=>p.id===id);},
  brDate(d){return d?.slice(0,10).split('-').reverse().join('/')||'';},today(){return '2026-11-05';},uid(){return 'r1';},
  esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));},
  entryHTML(){return '<div>original</div>';},openModal(){},closeModal(){},confirm(){return true;},alert(s){ctx.alerted=s;},
  downloadBlob(blob,name){ctx.downloaded={blob,name};},async persist(){ctx.persisted=true;},
  async invokeIsabelaAI(mode,question,context){ctx.sent={mode,question,context};return '**EVOLUÇÃO**\nMobilidade supervisionada. | Conduta: Treino de equilíbrio.';}
};
ctx.window=ctx;
vm.createContext(ctx);
ctx.VMUint8Array=vm.runInContext('Uint8Array',ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../pdf-lib.min.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../fontkit.umd.min.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../clinical_reports.js'),'utf8'),ctx);

(async()=>{
  await ctx.createSelectedDatesReport();
  assert.equal(ctx.sent.mode,'report');
  assert.ok(ctx.sent.context.includes('Treino de equilíbrio.'));
  assert.ok(!ctx.sent.context.includes('DADO NÃO SELECIONADO'));
  assert.ok(el('clinicalReportPreview').innerHTML.includes('07/10/2026'));
  assert.ok(!el('clinicalReportPreview').innerHTML.includes('10/10/2026'));
  assert.ok(!el('clinicalReportPreview').innerHTML.includes('**'));
  el('clinicalReportText').value='EVOLUÇÃO\nPaciente realizou mobilidade.\nConduta: Treino de equilíbrio.';
  ctx.updateClinicalReportPreview();
  await ctx.downloadClinicalReport();
  if(!ctx.downloaded)throw Error(ctx.alerted||'PDF não foi baixado');
  assert.ok(ctx.downloaded.blob.size>1000);
  const file='/tmp/isabela-relatorio-teste.pdf';
  fs.writeFileSync(file,Buffer.from(await ctx.downloaded.blob.arrayBuffer()));
  const content=execFileSync('pdftotext',[file,'-'],{encoding:'utf8'});
  for(const expected of ['Paciente Fictícia','07/10/2026','Treino de equilíbrio','Fisioterapeuta Teste'])assert.ok(content.includes(expected),expected);
  assert.ok(!content.includes('DADO NÃO SELECIONADO'));
  el('clinicalReportText').value=Array.from({length:90},(_,i)=>`Registro clínico ${i+1}: acompanhamento funcional descrito sem dados inventados.`).join('\n');
  ctx.updateClinicalReportPreview();
  await ctx.downloadClinicalReport();
  const longFile='/tmp/isabela-relatorio-longo-teste.pdf';
  fs.writeFileSync(longFile,Buffer.from(await ctx.downloaded.blob.arrayBuffer()));
  assert.ok(Number(execFileSync('pdfinfo',[longFile],{encoding:'utf8'}).match(/Pages:\s+(\d+)/)[1])>1);
  assert.ok(execFileSync('pdftotext',[longFile,'-'],{encoding:'utf8'}).includes('Registro clínico 90'));
  el('clinicalReportText').value='EVOLUÇÃO\nPaciente realizou mobilidade.\nConduta: Treino de equilíbrio.';
  ctx.updateClinicalReportPreview();
  await ctx.saveClinicalReport();
  assert.ok(ctx.persisted);assert.equal(patient.relatorios[0].reportMeta.dates.length,1);
  assert.ok(ctx.entryHTML(patient,'relatorios',patient.relatorios[0]).includes('Baixar PDF'));
  assert.ok(ctx.entryHTML(patient,'relatorios',patient.relatorios[0]).includes('Ver relatório completo'));
  el('selectedDatesReportFormat').value='summary';
  await ctx.createSelectedDatesReport();
  assert.ok(el('clinicalReportPreview').innerHTML.includes('Versão resumida'));
  assert.ok(!el('clinicalReportPreview').innerHTML.includes('Atendimentos selecionados'));
  console.log('Relatório estendido, filtro por data, revisão, PDF e salvamento: OK');
})().catch(e=>{console.error(e);process.exit(1)});
