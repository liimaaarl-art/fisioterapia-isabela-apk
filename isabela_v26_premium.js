/* Isabela Martins v26 • Avaliação Clínica Premium • Florindo Sistemas */
(function(){
'use strict';

const V26='26';
const esc26=v=>typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num26=v=>Number(v)||0;

function registryLabel(reg=''){
  const value=String(reg||'').trim();
  if(!value)return'';
  return /crefito/i.test(value)?value:`CREFITO ${value}`;
}
function professionalSnapshot(id){
  const p=typeof professionalById==='function'?professionalById(id):null;
  return p?{id:p.id||id||'',name:p.name||'',profession:p.profession||'Fisioterapeuta',registry:p.registry||''}:null;
}
function professionalText(id,snapshot){
  const p=snapshot||professionalSnapshot(id);
  if(!p)return'Não informado';
  return [p.name,registryLabel(p.registry)].filter(Boolean).join(' • ');
}
function ensureStyle(){
  if(document.getElementById('v26PremiumCss'))return;
  const s=document.createElement('style');s.id='v26PremiumCss';s.textContent=`
  .v26-section-title{grid-column:1/-1;margin:6px 0 -2px;padding:11px 13px;border-radius:14px;background:linear-gradient(135deg,#f7f1e6,#edf2e8);border:1px solid #ded4bd;color:#4d6047;font-weight:900;font-size:11px;letter-spacing:.02em}
  .v26-note{grid-column:1/-1;padding:11px 13px;border:1px solid #dce4d5;border-left:4px solid #879d7f;border-radius:12px;background:#fbfcf8;color:#65705f;font-size:9.5px;line-height:1.5}
  .v26-patient-meta{margin:0 0 18px;padding:12px 14px;border-radius:16px;background:#f8faf5;border:1px solid #dfe7d9;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .v26-patient-meta div{font-size:9px;color:#707b69}.v26-patient-meta b{display:block;margin-top:2px;color:#3f523b;font-size:10.5px}
  .v26-signature{margin-top:12px;padding:10px 12px;border-top:1px dashed #d8dfd1;background:#fbfcf9;border-radius:10px;color:#65705f;font-size:9px;line-height:1.45}
  .v26-signature b{color:#42523e}
  .v26-checks{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
  .v26-check{display:flex;align-items:flex-start;gap:8px;padding:9px 10px;border:1px solid #dfe5da;border-radius:11px;background:#fafbf7;font-size:9.5px;color:#586651}
  .v26-check input{width:auto;margin-top:1px}
  .v26-protocol{grid-column:1/-1;border:1px solid #dce4d5;border-radius:15px;background:#fffdf8;padding:12px 13px;font-size:9.5px;color:#62705d;line-height:1.55}
  .v26-protocol b{color:#40533b}
  .v26-functional-extra{margin-top:7px;padding:8px 9px;border-radius:10px;background:#f7f9f4;border:1px solid #e0e6da;font-size:8.8px;color:#667160;line-height:1.5}
  @media(max-width:700px){.v26-patient-meta,.v26-checks{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
}

function addField(sectionIndex,afterName,field){
  const section=typeof assessmentSections!=='undefined'?assessmentSections[sectionIndex]:null;
  if(!section||section.fields.some(f=>f[0]===field[0]))return;
  const idx=section.fields.findIndex(f=>f[0]===afterName);
  section.fields.splice(idx>=0?idx+1:section.fields.length,0,field);
}
function upgradeAssessmentSections(){
  if(typeof assessmentSections==='undefined')return;
  addField(0,'physioDiagnosis',['cbdfCode','CBDF-1 — código','text']);
  addField(0,'cbdfCode',['cbdfCategory','CBDF-1 — categoria / domínio','choice',['CBDF-S — Saúde Cinético-Funcional','CBDF-D — Deficiências Cinético-Funcionais','CBDF-M — Atividades de Mobilidade','CBDF-P — Participação Social']]);
  addField(0,'cbdfCategory',['cbdfDescription','CBDF-1 — descrição do diagnóstico cinético-funcional','area']);

  addField(1,'medications',['imagingExams','Exames complementares — imagem (tipo, data e achados relevantes)','area']);
  addField(1,'imagingExams',['labExams','Exames complementares — laboratoriais (tipo, data e achados relevantes)','area']);
  addField(1,'labExams',['priorReports','Laudos / pareceres anteriores — resumo clínico relevante','area']);
  addField(1,'priorReports',['requestedExams','Exames complementares solicitados / pendentes','area']);
  addField(1,'requestedExams',['previousTreatments','Tratamentos realizados anteriormente — tipo, período e resposta','area']);

  addField(3,'walking',['fallLastYear','Teve queda no último ano?','choice',['Sim','Não']]);
  addField(3,'fallLastYear',['unsteadyStandingWalking','Sente-se instável ao ficar em pé ou caminhar?','choice',['Sim','Não']]);
  addField(3,'unsteadyStandingWalking',['fearFalling','Tem medo ou preocupação de cair?','choice',['Sim','Não']]);
  addField(3,'fearFalling',['fallDetails','Quedas / risco de quedas — circunstâncias, frequência e lesões','area']);

  addField(4,'objective',['prognosis','Prognóstico fisioterapêutico','area']);
  addField(4,'prognosis',['plannedResources','Plano terapêutico — recursos, métodos e técnicas previstos','area']);
  addField(4,'plannedResources',['estimatedSessions','Quantitativo provável de atendimentos / frequência prevista','text']);
  assessmentSections[3].sub='Funcionalidade, medidas, amplitude, força e triagem de risco de quedas.';
  assessmentSections[4].sub='Mapa corporal, sensibilidade, testes, objetivos, prognóstico e plano de cuidado.';
}

function injectPatientFields(){
  const grid=document.querySelector('#patientModal .form-grid');
  if(!grid||document.getElementById('pNaturality'))return;
  const birth=document.getElementById('pBirth')?.closest('.field');
  const block=document.createElement('div');
  block.className='field';block.innerHTML='<label>Naturalidade</label><input id="pNaturality" placeholder="Cidade / UF de nascimento">';
  const gender=document.createElement('div');gender.className='field';gender.innerHTML='<label>Gênero</label><select id="pGender"><option value="">Não informado</option><option>Feminino</option><option>Masculino</option><option>Outro / não informado</option></select>';
  const marital=document.createElement('div');marital.className='field';marital.innerHTML='<label>Estado civil</label><select id="pMaritalStatus"><option value="">Não informado</option><option>Solteiro(a)</option><option>Casado(a)</option><option>União estável</option><option>Divorciado(a)</option><option>Viúvo(a)</option><option>Outro</option></select>';
  const occupation=document.createElement('div');occupation.className='field';occupation.innerHTML='<label>Profissão / ocupação</label><input id="pOccupation" placeholder="Profissão ou ocupação principal">';
  const workAddress=document.createElement('div');workAddress.className='field full';workAddress.innerHTML='<label>Endereço comercial / local de trabalho</label><input id="pWorkAddress" placeholder="Quando aplicável">';
  if(birth){birth.insertAdjacentElement('afterend',block);block.insertAdjacentElement('afterend',gender);gender.insertAdjacentElement('afterend',marital);marital.insertAdjacentElement('afterend',occupation);occupation.insertAdjacentElement('afterend',workAddress)}else{grid.append(block,gender,marital,occupation,workAddress)}
}

const oldOpenPatientModal=typeof openPatientModal==='function'?openPatientModal:null;
const oldSavePatient=typeof savePatient==='function'?savePatient:null;
if(oldOpenPatientModal){
  openPatientModal=function(id=''){
    injectPatientFields();oldOpenPatientModal(id);
    const p=typeof patientById==='function'?patientById(id):null;
    const nat=document.getElementById('pNaturality'),gender=document.getElementById('pGender'),mar=document.getElementById('pMaritalStatus'),occ=document.getElementById('pOccupation'),work=document.getElementById('pWorkAddress');
    if(nat)nat.value=p?.naturality||'';if(gender)gender.value=p?.gender||'';if(mar)mar.value=p?.maritalStatus||'';if(occ)occ.value=p?.occupation||'';if(work)work.value=p?.workAddress||'';
  };window.openPatientModal=openPatientModal;
}
if(oldSavePatient){
  savePatient=async function(){
    injectPatientFields();
    const extra={naturality:document.getElementById('pNaturality')?.value.trim()||'',gender:document.getElementById('pGender')?.value||'',maritalStatus:document.getElementById('pMaritalStatus')?.value||'',occupation:document.getElementById('pOccupation')?.value.trim()||'',workAddress:document.getElementById('pWorkAddress')?.value.trim()||''};
    const editId=typeof editingPatientId!=='undefined'?editingPatientId:'';
    await oldSavePatient();
    const p=typeof patientById==='function'?patientById(editId||(typeof selectedPatientId!=='undefined'?selectedPatientId:'')):null;
    if(p){Object.assign(p,extra,{updatedAt:new Date().toISOString()});await persist()}
  };window.savePatient=savePatient;
}

if(typeof imProfessional==='function'){
  imProfessional=function(id){return professionalText(id)};window.imProfessional=imProfessional;
}

const oldEvaluationEditor=typeof evaluationEditor==='function'?evaluationEditor:null;
if(oldEvaluationEditor){
  evaluationEditor=function(){
    let html=oldEvaluationEditor();
    if(!evaluationWork)return html;
    const p=typeof imPatient==='function'?imPatient(evaluationWork.patientId):patientById(evaluationWork.patientId);
    const meta=`<div class="v26-patient-meta"><div>Naturalidade<b>${esc26(p?.naturality||'Não informado')}</b></div><div>Gênero<b>${esc26(p?.gender||p?.sex||'Não informado')}</b></div><div>Estado civil<b>${esc26(p?.maritalStatus||'Não informado')}</b></div><div>Profissão / ocupação<b>${esc26(p?.occupation||'Não informado')}</b></div><div>Endereço comercial<b>${esc26(p?.workAddress||'Não informado')}</b></div></div>`;
    html=html.replace('<div class="eval-form">','<div class="eval-form">'+meta);
    if(evaluationStep===0)html=html.replace('<div class="formgrid">','<div class="v26-note"><b>CBDF-1:</b> registre código, categoria e descrição conforme a classificação oficial vigente. O aplicativo organiza o prontuário, mas não substitui a validação clínica do fisioterapeuta.</div><div class="formgrid">');
    if(evaluationStep===3)html=html.replace('<div class="formgrid">','<div class="v26-note"><b>Triagem de quedas:</b> as três perguntas abaixo complementam o exame funcional e ajudam a direcionar testes como TUG, Berg e Sentar/Levantar. Resultado isolado não define diagnóstico.</div><div class="formgrid">');
    return html;
  };window.evaluationEditor=evaluationEditor;
}

function attachSnapshot(record,professionalId){
  if(!record)return;
  const snap=professionalSnapshot(professionalId||record.professionalId);
  record.professionalId=professionalId||record.professionalId||snap?.id||'';
  if(snap)record.professionalSnapshot=snap;
  record.clinicalFormVersion='v26';
}
const oldSaveEvaluation=typeof saveEvaluation==='function'?saveEvaluation:null;
if(oldSaveEvaluation){
  saveEvaluation=async function(final){
    const id=typeof evaluationWork!=='undefined'?evaluationWork?.id:'';
    const pro=typeof evaluationWork!=='undefined'?evaluationWork?.professionalId:'';
    await oldSaveEvaluation(final);
    const record=assessments.find(a=>a.id===id);
    if(record){attachSnapshot(record,pro);await persist(true)}
  };window.saveEvaluation=saveEvaluation;
}

const oldSaveDailyEvolution=typeof saveDailyEvolution==='function'?saveDailyEvolution:null;
if(oldSaveDailyEvolution){
  saveDailyEvolution=async function(){
    const editId=typeof editingDailyEvolutionId!=='undefined'?editingDailyEvolutionId:'';
    const apptId=typeof dailyEvolutionAppointmentId!=='undefined'?dailyEvolutionAppointmentId:'';
    const pid=document.getElementById('dePatient')?.value||'';
    const d=document.getElementById('deDate')?.value||'';
    const app=appointments.find(a=>a.id===apptId),p=patientById(pid),pro=app?.professionalId||p?.professionalId||professionals[0]?.id||'';
    await oldSaveDailyEvolution();
    let evo=editId&&typeof findEvolutionById==='function'?findEvolutionById(editId)?.evolution:null;
    if(!evo&&apptId&&typeof evolutionForAppointment==='function')evo=evolutionForAppointment(appointments.find(a=>a.id===apptId));
    if(!evo&&p)evo=(p.evolucoes||[]).filter(e=>!d||e.date===d).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).at(0);
    if(evo){attachSnapshot(evo,pro);await persist()}
  };window.saveDailyEvolution=saveDailyEvolution;
}

const oldEntryHTML=typeof entryHTML==='function'?entryHTML:null;
if(oldEntryHTML){
  entryHTML=function(p,type,e){
    let html=oldEntryHTML(p,type,e);
    if(type!=='evolucoes')return html;
    const snap=e.professionalSnapshot||professionalSnapshot(e.professionalId||p?.professionalId);
    if(!snap)return html;
    const sig=`<div class="v26-signature"><b>Registro profissional:</b> ${esc26(professionalText(snap.id,snap))}${e.updatedAt?`<br><span>Atualizado em ${esc26(new Date(e.updatedAt).toLocaleString('pt-BR'))}</span>`:''}</div>`;
    const pos=html.lastIndexOf('</div>');return pos>=0?html.slice(0,pos)+sig+html.slice(pos):html+sig;
  };window.entryHTML=entryHTML;
}

const CHAIR_NORMS26={'60-64':{Masculino:14,Feminino:12},'65-69':{Masculino:12,Feminino:11},'70-74':{Masculino:12,Feminino:10},'75-79':{Masculino:11,Feminino:10},'80-84':{Masculino:10,Feminino:9},'85-89':{Masculino:8,Feminino:8},'90-94':{Masculino:7,Feminino:4}};
const FT_INFO26={chair:{name:'Sentar e levantar • 30 s',unit:'repetições',icon:'↕'},tug:{name:'Timed Up and Go • TUG',unit:'segundos',icon:'⏱'},berg:{name:'Escala de Equilíbrio de Berg',unit:'pontos',icon:'◒'}};
const TUG_OBS26=['Ritmo lento ou hesitante','Perda de equilíbrio','Passos curtos','Pouco ou nenhum balanço dos braços','Apoia-se nas paredes para se estabilizar','Arrasta os pés / marcha em shuffling','Giro em bloco','Uso inadequado do dispositivo de auxílio'];
let ft26Type='chair',ft26Edit='';
function age26(p,d=typeof today==='function'?today():new Date().toISOString().slice(0,10)){if(!p?.birth)return'';let b=new Date(p.birth+'T12:00:00'),x=new Date(d+'T12:00:00'),a=x.getFullYear()-b.getFullYear();if(x.getMonth()<b.getMonth()||(x.getMonth()===b.getMonth()&&x.getDate()<b.getDate()))a--;return a>=0?a:''}
function ftValue26(a){const f=a.functionalTest||{};return f.type==='chair'?num26(f.reps):f.type==='tug'?num26(f.seconds):num26(f.score)}
function ftInterpret26(f){
  if(f.type==='tug'){
    const age=Number(f.age),seconds=Number(f.seconds)||0;
    if(!Number.isFinite(age)||age<=0)return['Resultado registrado','neutral','Tempo do TUG registrado. Informe a idade para contextualizar a triagem.'];
    if(age>=65)return seconds>=12?['Atenção na triagem de quedas','risk','Em adultos com 65 anos ou mais, 12 s ou mais é um sinal de atenção no STEADI; interpretar junto aos demais achados.']:['Abaixo de 12 s','ok','Não atingiu o ponto de atenção de 12 s usado no STEADI para adultos mais velhos.'];
    return['Resultado registrado','neutral',`Paciente com ${age} anos: o corte de 12 s do STEADI não é aplicado automaticamente fora da população idosa. Interprete pelo contexto clínico.`];
  }
  if(f.type==='berg')return[`Berg • ${num26(f.score)}/56`,'neutral','Resultado total registrado. Interprete a pontuação com diagnóstico, idade, histórico de quedas e demais achados funcionais.'];
  if(f.arms)return['Teste interrompido • 0','risk','Uso dos braços foi marcado; no protocolo de 30 s do STEADI o teste é interrompido e o resultado é registrado como 0.'];
  const band=Object.keys(CHAIR_NORMS26).find(k=>{let z=k.split('-').map(Number);return Number(f.age)>=z[0]&&Number(f.age)<=z[1]}),cut=CHAIR_NORMS26[band]?.[f.sex];
  if(!cut)return['Resultado registrado','neutral','Sem referência automática para esta idade/sexo; mantenha a interpretação clínica.'];
  return num26(f.reps)<cut?['Abaixo da referência','risk',`Referência STEADI ${band} anos: abaixo de ${cut} repetições.`]:['Dentro/acima da referência','ok',`Referência STEADI ${band} anos: ${cut} ou mais repetições.`];
}
function ftPreview26(){
  const box=document.getElementById('ftPreview');if(!box)return;
  let f={type:ft26Type,age:num26(document.getElementById('ftAgeInput')?.value)};
  if(ft26Type==='chair'){f.sex=document.getElementById('ftSex')?.value||'';f.reps=num26(document.getElementById('ftReps')?.value);f.arms=!!document.getElementById('ftArms')?.checked}
  else if(ft26Type==='tug')f.seconds=num26(document.getElementById('ftSeconds')?.value);
  else{let v=[...document.querySelectorAll('.ftScore')].map(x=>x.value===''?null:Number(x.value));f.score=v.reduce((s,x)=>s+(x||0),0);if(v.some(x=>x===null)){box.innerHTML=`<div class="ftRef neutral">${v.filter(x=>x!==null).length}/14 itens • ${f.score} pontos</div>`;return}}
  const q=ftInterpret26(f);box.innerHTML=`<div class="ftRef ${q[1]}"><b>${q[0]}</b><br>${q[2]}</div>`;
}
const oldFtOpen26=typeof window.ftOpen==='function'?window.ftOpen:null;
window.ftOpen=function(t='chair',pid='',id=''){
  const existing=id?assessments.find(x=>x.id===id):null;
  const requested=existing?.functionalTest?.type||t;
  if(requested==='berg'&&oldFtOpen26){ft26Type='berg';ft26Edit=id;return oldFtOpen26('berg',pid,id)}
  if(!document.getElementById('ftModal'))return;
  ft26Type=t;ft26Edit=id;
  const a=id?assessments.find(x=>x.id===id):null;if(a){ft26Type=a.functionalTest?.type||t;pid=a.patientId}
  pid=pid||(typeof selectedPatientId!=='undefined'?selectedPatientId:'')||patients[0]?.id||'';
  const p=patientById(pid),d=a?.date||(typeof today==='function'?today():new Date().toISOString().slice(0,10)),f=a?.functionalTest||{},ag=f.age??age26(p,d);let specific='';
  if(ft26Type==='chair')specific=`<div class="field"><label>Sexo para referência</label><select id="ftSex"><option></option><option ${f.sex==='Feminino'?'selected':''}>Feminino</option><option ${f.sex==='Masculino'?'selected':''}>Masculino</option></select></div><div class="field"><label>Nº de vezes que conseguiu</label><input id="ftReps" type="number" min="0" value="${esc26(f.rawReps??f.reps??'')}"></div><div class="field"><label>Altura aproximada da cadeira (cm)</label><input id="ftChairHeight" type="number" min="0" step="0.1" value="${esc26(f.chairHeight??'43')}"></div><div class="field"><label><input id="ftArms" type="checkbox" style="width:auto" ${f.arms?'checked':''}> Precisou usar os braços</label></div><div class="field full"><label><input id="ftInterrupted" type="checkbox" style="width:auto" ${f.interrupted?'checked':''}> Teste interrompido por sintoma, dor, fadiga ou insegurança</label></div><div class="v26-protocol"><b>Protocolo:</b> levantar e sentar o maior número possível de vezes em 30 segundos, com braços cruzados quando seguro. Registre intercorrências nas observações.</div>`;
  else if(ft26Type==='tug')specific=`<div class="field"><label>Tempo total (segundos)</label><input id="ftSeconds" type="number" min="0" step="0.1" value="${esc26(f.seconds??'')}"></div><div class="field"><label>Dispositivo de auxílio</label><select id="ftAid"><option ${!f.aid?'selected':''}>Sem auxílio</option>${['Bengala','Andador','Muletas','Outro'].map(v=>`<option ${f.aid===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="v26-protocol"><b>TUG:</b> levantar da cadeira, caminhar 3 metros em ritmo habitual e seguro, virar, retornar e sentar. Cronometrar o percurso completo.</div><div class="field full"><label>Observações padronizadas durante o TUG</label><div class="v26-checks">${TUG_OBS26.map(v=>`<label class="v26-check"><input class="v26TugObs" type="checkbox" value="${esc26(v)}" ${(f.observations||[]).includes(v)?'checked':''}><span>${esc26(v)}</span></label>`).join('')}</div></div>`;
  else specific='<div class="v26-protocol">A Escala de Berg será aberta com os 14 movimentos e critérios detalhados.</div>';
  document.getElementById('ftTitle').textContent=(a?'Editar • ':'Novo • ')+FT_INFO26[ft26Type].name;
  document.getElementById('ftBody').innerHTML=`<div class="form-grid"><div class="field"><label>Paciente</label><select id="ftPatient">${patients.map(x=>`<option value="${x.id}" ${x.id===pid?'selected':''}>${esc26(x.name)}</option>`).join('')}</select></div><div class="field"><label>Data</label><input id="ftDate" type="date" value="${d}"></div><div class="field"><label>Idade</label><input id="ftAgeInput" type="number" min="0" max="120" value="${esc26(ag)}"></div>${specific}<div class="field full"><label>Observações clínicas</label><textarea id="ftNotes">${esc26(f.notes||'')}</textarea></div><div class="field full" id="ftPreview"></div></div>`;
  document.querySelectorAll('#ftBody input,#ftBody select').forEach(x=>x.addEventListener('input',ftPreview26));
  document.getElementById('ftPatient').onchange=function(){const q=patientById(this.value);document.getElementById('ftAgeInput').value=age26(q,document.getElementById('ftDate').value);ftPreview26()};
  openModal('ftModal');ftPreview26();
};
window.ftSave=async function(){
  const pid=document.getElementById('ftPatient')?.value,d=document.getElementById('ftDate')?.value,ageEl=document.getElementById('ftAgeInput'),ag=num26(ageEl?.value),notes=document.getElementById('ftNotes')?.value.trim()||'';
  if(!pid||!d||!ageEl||ageEl.value==='')return alert('Informe paciente, data e idade.');
  let f={type:ft26Type,age:ag,notes,protocolVersion:'v26'};
  if(ft26Type==='chair'){
    const r=document.getElementById('ftReps'),sex=document.getElementById('ftSex')?.value||'',arms=!!document.getElementById('ftArms')?.checked;
    if(!r||r.value===''||!sex)return alert('Informe sexo e número de repetições.');
    f.rawReps=num26(r.value);f.reps=arms?0:num26(r.value);f.arms=arms;f.sex=sex;f.chairHeight=num26(document.getElementById('ftChairHeight')?.value);f.interrupted=!!document.getElementById('ftInterrupted')?.checked;
  }else if(ft26Type==='tug'){
    const x=num26(document.getElementById('ftSeconds')?.value);if(x<=0)return alert('Informe o tempo do TUG.');
    f.seconds=x;f.aid=document.getElementById('ftAid')?.value||'Sem auxílio';f.distanceMeters=3;f.observations=[...document.querySelectorAll('.v26TugObs:checked')].map(x=>x.value);
  }else{
    f.items=[...document.querySelectorAll('.ftScore')].map(x=>x.value===''?null:Number(x.value));if(f.items.some(x=>x===null))return alert('Preencha os 14 itens da Berg.');f.score=f.items.reduce((s,x)=>s+x,0);
  }
  const q=ftInterpret26(f);f.interpretation=q[0];f.interpretationNote=q[2];
  const p=patientById(pid),pro=p?.professionalId||professionals[0]?.id||'';
  const answers={Idade:String(ag),Resultado:ft26Type==='tug'?f.seconds+' s':ft26Type==='berg'?f.score+'/56':f.reps+' repetições',Interpretação:q[0],Observações:notes};
  if(ft26Type==='tug'){answers['Dispositivo de auxílio']=f.aid;answers['Observações padronizadas']=f.observations.length?f.observations.join(', '):'Nenhuma marcada'}
  if(ft26Type==='chair'){answers['Altura da cadeira']=f.chairHeight?f.chairHeight+' cm':'Não informada';answers['Uso dos braços']=f.arms?'Sim':'Não';answers['Teste interrompido']=f.interrupted?'Sim':'Não'}
  const obj={patientId:pid,date:d,title:FT_INFO26[ft26Type].name,functionalTest:f,answers,professionalId:pro,professionalSnapshot:professionalSnapshot(pro),clinicalFormVersion:'v26',updatedAt:new Date().toISOString()};
  if(ft26Edit){const a=assessments.find(x=>x.id===ft26Edit);if(a)Object.assign(a,obj)}else assessments.push({id:uid(),createdAt:new Date().toISOString(),...obj});
  ft26Edit='';closeModal('ftModal');selectedPatientId=pid;patientTab='funcionais';currentPage='patients';await persist();
};

function functionalCard26(a){
  const f=a.functionalTest||{},info=FT_INFO26[f.type]||{name:a.title||'Teste funcional',unit:'',icon:'•'},q=ftInterpret26(f),extra=f.type==='tug'&&f.observations?.length?`<div class="v26-functional-extra"><b>Observações TUG:</b> ${esc26(f.observations.join(' • '))}</div>`:f.type==='chair'?`<div class="v26-functional-extra">Cadeira: ${f.chairHeight?esc26(f.chairHeight)+' cm':'não informada'} • braços: ${f.arms?'sim':'não'}${f.interrupted?' • interrompido':''}</div>`:'';
  return `<div class="mini-card"><h3>${info.icon} ${esc26(info.name)}</h3><p>${brDate(a.date)} • ${esc26(patientById(a.patientId)?.name||'')}</p><div class="ftValue">${ftValue26(a)} ${esc26(info.unit)}</div><div class="ftRef ${q[1]}"><b>${esc26(q[0])}</b><br>${esc26(q[2])}</div>${extra}${f.notes?`<p><b>Obs.:</b> ${esc26(f.notes)}</p>`:''}<div class="v26-signature"><b>${esc26(professionalText(a.professionalId,a.professionalSnapshot))}</b></div><div class="actions"><button class="btn tiny" onclick="ftOpen('${f.type}','${a.patientId}','${a.id}')">Editar</button><button class="btn tiny red" onclick="deleteAssessment('${a.id}')">Excluir</button></div></div>`;
}
const previousAssessmentCard=typeof assessmentCard==='function'?assessmentCard:null;
if(previousAssessmentCard){assessmentCard=function(a,full=false){return a?.functionalTest?functionalCard26(a):previousAssessmentCard(a,full)};window.assessmentCard=assessmentCard}

const previousRenderPatientDetail=typeof renderPatientDetail==='function'?renderPatientDetail:null;
if(previousRenderPatientDetail){
  renderPatientDetail=function(){
    previousRenderPatientDetail();
    const p=patientById(typeof selectedPatientId!=='undefined'?selectedPatientId:'');if(!p)return;
    if(patientTab==='dados'){
      const grid=document.querySelector('#main .info-grid');if(grid&&!grid.querySelector('.v26-demographic')){
        const cards=[['Naturalidade',p.naturality],['Gênero',p.gender],['Estado civil',p.maritalStatus],['Profissão / ocupação',p.occupation],['Endereço comercial',p.workAddress]];
        cards.reverse().forEach(([label,value])=>grid.insertAdjacentHTML('afterbegin',`<div class="info v26-demographic"><label>${label}</label><div>${esc26(value||'-')}</div></div>`));
        const prof=[...grid.querySelectorAll('.info')].find(x=>x.querySelector('label')?.textContent==='Profissional');if(prof){const pr=professionalById(p.professionalId);prof.querySelector('div').textContent=professionalText(pr?.id)}
      }
    }
    if(patientTab==='funcionais'){
      const cards=document.querySelector('#main .panel .cards');if(cards){const arr=assessments.filter(a=>a.functionalTest&&a.patientId===p.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));cards.innerHTML=arr.length?arr.map(functionalCard26).join(''):'<div class="empty">Nenhum teste funcional aplicado.</div>'}
    }
  };window.renderPatientDetail=renderPatientDetail;
}

try{patients.forEach(p=>{if(p.naturality==null)p.naturality='';if(p.gender==null)p.gender='';if(p.maritalStatus==null)p.maritalStatus='';if(p.occupation==null)p.occupation='';if(p.workAddress==null)p.workAddress=''})}catch{}
ensureStyle();upgradeAssessmentSections();injectPatientFields();
console.info('Isabela Martins v26 • Avaliação Clínica Premium carregada');
})();