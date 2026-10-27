const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const script=fs.readFileSync('isabela_v34_audio.js','utf8');
const tick=()=>new Promise(r=>setTimeout(r,15));
function setup(shared=new Map()){
  const elements=new Map(),requests=[],alerts=[];let apiError=false,cloudError=false,localError=false,cloudData;
  function element(id){
    if(elements.has(id))return elements.get(id);
    const classes=new Set();
    const e={id,value:'',textContent:'',style:{},disabled:false,hidden:false,dataset:{},classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k)},querySelector:()=>null,querySelectorAll:()=>[],contains:t=>t?.modal===id,dispatchEvent(){}};
    elements.set(id,e);return e;
  }
  const document={getElementById:element,addEventListener(){},readyState:'complete'};
  const indexedDB={open(){const r={};setTimeout(()=>{r.result={transaction(){const tx={};tx.objectStore=()=>({get(key){const q={};setTimeout(()=>{q.result=structuredClone(shared.get(key));tx.oncomplete?.();},0);return q;},put(data){shared.set(data.key,structuredClone(data));const q={};setTimeout(()=>tx.oncomplete?.(),0);return q;},delete(key){shared.delete(key);const q={};setTimeout(()=>tx.oncomplete?.(),0);return q;}});return tx;}};r.onsuccess();},0);return r;}};
  class Recorder{
    static isTypeSupported(){return true;}
    constructor(stream,opts){this.state='inactive';this.mimeType=opts.mimeType;this.opts=opts;Recorder.last=this;}
    start(){this.state='recording';}
    pause(){this.state='paused';}
    resume(){this.state='recording';}
    stop(){this.state='inactive';setTimeout(()=>{this.ondataavailable?.({data:new Blob(['audio complete final chunk'])});this.onstop?.({});},0);}
  }
  const structured={vitalSignsInitial:'PA 120x80',dailyAssessment:'Dor 6/10',objective:'',conduct:'Alongamentos',vitalSignsFinal:'',observation:''};
  const ctx={console,Blob,Event,MediaRecorder:Recorder,indexedDB,document,setTimeout,clearTimeout,structuredClone,Date,Promise,JSON,Map,Set,
    navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},
    currentUser:{id:'user-test'},patients:[{id:'patient-test',professionalId:'pro-test',evolucoes:[],relatorios:[],observacoes:[]}],appointments:[],professionals:[{id:'pro-test',name:'Profissional Teste'}],dailyEvolutionAppointmentId:'',editingDailyEvolutionId:'',selectedPatientId:'patient-test',entryType:'relatorios',editingEntryId:'',pendingDailyEvolutionAttachments:[],pendingAttachments:[],db:{},cloudReady:false,syncing:false,storageMode:'supabase',lastCloudSync:'',
    stopLiveDictation(){},microphoneError:e=>e.message,blobBase64Raw:async b=>Buffer.from(await b.arrayBuffer()).toString('base64'),describeAIError:async e=>e.message,
    setEvolutionAudioStatus:msg=>element('deAudioStatus').textContent=msg,setReportAudioStatus:msg=>element('reportAudioStatus').textContent=msg,
    patientById:id=>ctx.patients.find(p=>p.id===id),professionalById:id=>ctx.professionals.find(p=>p.id===id),clone:structuredClone,today:()=> '2026-10-24',uid:(()=>{let i=0;return()=>`test-${++i}`;})(),
    findEvolutionById:id=>{for(const p of ctx.patients){const e=p.evolucoes.find(e=>e.id===id);if(e)return{patient:p,evolution:e};}return null;},evolutionText:o=>Object.values(o).filter(v=>typeof v==='string').join('\n'),syncAppointmentFinance(){},updateStorage(){},render(){},
    saveDB:async()=>{if(localError)throw Error('local quota');},statePayload:()=>structuredClone({patients:ctx.patients}),localStorage:{setItem(){}},fallbackKey:()=> 'test',
    alert:m=>alerts.push(m),confirm:()=>true,addEventListener(){},
    closeModal(id){element(id).classList.remove('show');if(id==='dailyEvolutionModal')ctx.resetEvolutionRecording();else ctx.resetReportRecording();},
    openDailyEvolutionModal(){element('dailyEvolutionModal').classList.add('show');},openEntryModal(){element('entryModal').classList.add('show');},
    sb:{functions:{async invoke(name,{body}){requests.push(body);if(apiError&&body.mode==='query')return{error:{message:'IA indisponível'}};return{data:{text:body.mode==='transcribe'?'Paciente com dor 6/10. PA 120x80. Realizados alongamentos.':JSON.stringify(structured)}};}},from(){return{upsert(data){return{select(){return{async single(){if(cloudError)return{error:{message:'Sem conexão'}};cloudData=structuredClone(data);return{data:{user_id:data.user_id,updated_at:data.updated_at}};}};}};}};}}};
  ctx.window=ctx;vm.createContext(ctx);const originalSaveDB=ctx.saveDB;vm.runInContext(script,ctx);ctx.saveDB=originalSaveDB;
  element('dePatient').value='patient-test';element('deDate').value=element('eDate').value='2026-10-24';
  return{ctx,element,requests,alerts,Recorder,shared,failAPI:v=>apiError=v,failCloud:v=>cloudError=v,failLocal:v=>localError=v,get cloudData(){return cloudData;},structured,async open(kind='evolution'){ctx[kind==='evolution'?'openDailyEvolutionModal':'openEntryModal']();await tick();}};
}

test('Gravar → pausar/continuar → enviar waits for final chunk and automatically fills',async()=>{
 const s=setup();await s.open();await s.ctx.toggleEvolutionRecording();assert.equal(s.Recorder.last.opts.audioBitsPerSecond,32000);
 await s.ctx.toggleEvolutionRecording();assert.equal(s.Recorder.last.state,'paused');await s.ctx.toggleEvolutionRecording();assert.equal(s.Recorder.last.state,'recording');await s.ctx.toggleEvolutionRecording();
 await s.ctx.sendEvolutionRecordingToAI();assert.deepEqual(s.requests.map(r=>r.mode),['transcribe','query']);assert.equal(Buffer.from(s.requests[0].audioBase64,'base64').toString(),'audio complete final chunk');
 assert.equal(s.element('deConduct').value,'Alongamentos');assert.equal(s.element('deObjective').value,'');assert.equal(s.element('deFinishBtn').hidden,true);assert.match(s.element('deAudioStatus').textContent,/Revise/);
});

test('retry preserves audio/transcript, does not transcribe or append the same audio twice',async()=>{
 const s=setup();await s.open();await s.ctx.toggleEvolutionRecording();s.failAPI(true);await s.ctx.sendEvolutionRecordingToAI();const raw=s.element('deAIRaw').value;
 assert.match(s.element('deAudioStatus').textContent,/Tentar novamente/);s.failAPI(false);await s.ctx.sendEvolutionRecordingToAI();assert.equal(s.element('deAIRaw').value,raw);assert.equal(s.requests.filter(r=>r.mode==='transcribe').length,1);assert.equal(s.requests.filter(r=>r.mode==='query').length,2);
});

test('failed cloud and local writes keep editor open; retry keeps ID and confirms persisted record',async()=>{
 const s=setup();await s.open();s.element('deDailyAssessment').value='Relato teste';s.failCloud(true);s.failLocal(true);await s.ctx.saveDailyEvolution();assert.equal(s.element('dailyEvolutionModal').classList.contains('show'),true);assert.match(s.element('deAudioStatus').textContent,/cópia local também falhou/);assert.equal(s.alerts.length,0);
 const id=s.ctx.patients[0].evolucoes[0].id;s.failCloud(false);s.failLocal(false);await s.ctx.saveDailyEvolution();assert.equal(s.ctx.patients[0].evolucoes.length,1);assert.equal(s.cloudData.data.patients[0].evolucoes[0].id,id);assert.equal(s.cloudData.data.patients[0].evolucoes[0].dailyAssessment,'Relato teste');assert.equal(s.cloudData.data.patients[0].evolucoes[0].professionalSnapshot.name,'Profissional Teste');assert.equal(s.element('dailyEvolutionModal').classList.contains('show'),false);assert.match(s.alerts[0],/Salvo com sucesso/);
 await tick();assert.equal(s.shared.size,0,'saved draft must not be recreated by closeModal');
});

test('a manual field is preserved; repeated audio can update untouched AI fields',async()=>{
 const s=setup();await s.open();s.element('deVitalInitial').value='Manual: PA 110x70';await s.ctx.toggleEvolutionRecording();await s.ctx.sendEvolutionRecordingToAI();assert.equal(s.element('deVitalInitial').value,'Manual: PA 110x70');
 s.structured.conduct='Alongamentos e marcha';await s.ctx.toggleEvolutionRecording();await s.ctx.sendEvolutionRecordingToAI();assert.equal(s.element('deConduct').value,'Alongamentos e marcha');
});

test('report paused recording sends and fills report in one action',async()=>{
 const s=setup();await s.open('report');await s.ctx.toggleReportRecording();await s.ctx.toggleReportRecording();await s.ctx.sendReportRecordingToAI();assert.match(s.element('eText').value,/dor 6\/10/);assert.deepEqual(s.requests.map(r=>r.mode),['transcribe']);await s.ctx.saveEntry();assert.equal(s.cloudData.data.patients[0].relatorios.length,1);
});

test('closing and reopening recovers audio and text from account-scoped IndexedDB',async()=>{
 const s=setup();await s.open();s.element('deAIRaw').value='Texto manual preservado';await s.ctx.toggleEvolutionRecording();s.ctx.closeModal('dailyEvolutionModal');await tick();await tick();assert.equal(s.shared.size,1);
 const next=setup(s.shared);await next.open();assert.equal(next.element('deAIRaw').value,'Texto manual preservado');await next.ctx.sendEvolutionRecordingToAI();assert.equal(next.requests[0].mode,'transcribe');assert.match(next.element('deAIRaw').value,/Texto manual preservado/);
 const other=setup(s.shared);other.ctx.currentUser={id:'different-user'};await other.open();assert.equal(other.element('deAIRaw').value,'');
});

test('context mismatch cannot send audio into a different patient',async()=>{
 const s=setup();await s.open();await s.ctx.toggleEvolutionRecording();s.element('dePatient').value='different-patient';await s.ctx.sendEvolutionRecordingToAI();assert.equal(s.requests.length,0);assert.match(s.element('deAudioStatus').textContent,/paciente ou a data mudou/);
});

test('overlapping send clicks are ignored and modal stays open during processing',async()=>{
 const s=setup();await s.open();await s.ctx.toggleEvolutionRecording();const sending=s.ctx.sendEvolutionRecordingToAI();s.ctx.closeModal('dailyEvolutionModal');await s.ctx.sendEvolutionRecordingToAI();assert.equal(s.element('dailyEvolutionModal').classList.contains('show'),true);await sending;assert.equal(s.requests.filter(r=>r.mode==='transcribe').length,1);
});

test('multiple paragraphs remain intact in organizer context',async()=>{
 const s=setup();await s.open();const raw=Array.from({length:30},(_,i)=>`Parágrafo ${i}: paciente relata evolução e realizou exercícios.`).join('\n\n');s.element('deAIRaw').value=raw;await s.ctx.sendEvolutionRecordingToAI();assert.equal(s.requests[0].context,raw);assert.equal(s.requests[0].mode,'query');
});

function fakeDecodedAudio(s,seconds=125){
 const rate=1000, samples=new Float32Array(rate*seconds).fill(0.1);
 s.ctx.AudioContext=class {async decodeAudioData(){return {length:samples.length,sampleRate:rate,numberOfChannels:1,duration:seconds,getChannelData:()=>samples};}async close(){}};
}

test('long audio becomes complete WAV segments in order, then organized once',async()=>{
 const s=setup();fakeDecodedAudio(s);await s.open();let count=0;
 s.ctx.sb.functions.invoke=async(name,{body})=>{
   s.requests.push(body);
   if(body.mode==='transcribe')return {data:{text:['Início: PA 120 por 80.','Conduta: marcha assistida.','Final: dor 3 de 10.'][count++]}};
   return {data:{text:JSON.stringify(s.structured)}};
 };
 await s.ctx.toggleEvolutionRecording();await s.ctx.sendEvolutionRecordingToAI();
 assert.deepEqual(s.requests.map(x=>x.mode),['transcribe','transcribe','transcribe','query']);
 for(const item of s.requests.slice(0,3)){
   const bytes=Buffer.from(item.audioBase64,'base64');assert.equal(item.mimeType,'audio/wav');assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.equal(bytes.readUInt32LE(40),bytes.length-44);
 }
 assert.match(s.requests[3].context,/Início: PA 120 por 80\.[\s\S]*Conduta: marcha assistida\.[\s\S]*Final: dor 3 de 10/);
});

test('failure at a segment resumes from saved progress without repeating previous speech',async()=>{
 const shared=new Map(), s=setup(shared);fakeDecodedAudio(s);await s.open();let n=0;
 s.ctx.sb.functions.invoke=async(name,{body})=>{
   s.requests.push(body);
   if(body.mode==='transcribe'){n++;return n===2?{error:{message:'falha simulada'}}:{data:{text:'Trecho primeiro'}};}
   return {data:{text:JSON.stringify(s.structured)}};
 };
 await s.ctx.toggleEvolutionRecording();await s.ctx.sendEvolutionRecordingToAI();
 assert.match(s.element('deAudioStatus').textContent,/Tentar novamente/);
 assert.equal([...shared.values()][0].transcriptParts.length,1);
 const next=setup(shared);fakeDecodedAudio(next);await next.open();let part=1;
 next.ctx.sb.functions.invoke=async(name,{body})=>{next.requests.push(body);return {data:{text:body.mode==='transcribe'?['Trecho segundo','Trecho terceiro'][part++ - 1]:JSON.stringify(next.structured)}};};
 await next.ctx.sendEvolutionRecordingToAI();
 assert.deepEqual(next.requests.map(x=>x.mode),['transcribe','transcribe','query']);
 assert.equal(next.requests[2].context,'Trecho primeiro\n\nTrecho segundo\n\nTrecho terceiro');
 assert.equal(next.element('deAIRaw').value,next.requests[2].context);
});

test('manual field differences are preserved and review is clearly requested',async()=>{
 const s=setup();await s.open();s.element('deVitalInitial').value='Ajustado pela profissional';s.element('deAIRaw').value='Texto de evolução';
 await s.ctx.sendEvolutionRecordingToAI();
 assert.equal(s.element('deVitalInitial').value,'Ajustado pela profissional');
 assert.match(s.element('deAudioStatus').textContent,/Compare com o relato/);
});

