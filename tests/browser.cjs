const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const errors=[];
 const server=http.createServer((req,res)=>{const f=path.join(process.cwd(),'www',req.url==='/'?'index.html':req.url);if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(f));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:`window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){}},functions:{invoke:async(name,{body})=>{window.testRequests.push(body);return {data:{text:body.mode==='transcribe'?'Paciente com dor 6/10. Alongamentos realizados.':JSON.stringify({vitalSignsInitial:'',dailyAssessment:'Dor 6/10',objective:'',conduct:'Alongamentos realizados.',vitalSignsFinal:'',observation:''})}};}},from(){return {upsert(data){return {select(){return {single:async()=>{if(window.testCloudFail)return {error:{message:'Falha simulada'}};window.testCloud=structuredClone(data);return {data:{user_id:data.user_id,updated_at:data.updated_at}};}}}}}}}}}};window.testRequests=[];` }));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>typeof sendEvolutionRecordingToAI==='function');
  await page.evaluate(async()=>{
   currentUser={id:'synthetic-qa-user'};db=await openDB();patients=[{id:'synthetic-qa-patient',name:'Paciente de teste',status:'Ativo',evolucoes:[],relatorios:[],observacoes:[]}];selectedPatientId=patients[0].id;professionals=[];appointments=[];categories=[];finance=[];templates=[];recurrences=[];
   document.getElementById('authScreen').style.display='none';document.getElementById('authLoading').style.display='none';document.getElementById('appShell').style.display='grid';
   class FakeRecorder{static isTypeSupported(){return true;}constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}pause(){this.state='paused';}resume(){this.state='recording';}stop(){this.state='inactive';setTimeout(()=>{this.ondataavailable?.({data:new Blob(['fake microphone final chunk'])});this.onstop?.({});},0);}}
   window.MediaRecorder=FakeRecorder;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>({getTracks:()=>[{stop(){}}]})});
   openDailyEvolutionModal('','','synthetic-qa-patient');
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#deFinishBtn').isVisible(),false);assert.equal(await page.locator('#deGeminiFillBtn').isVisible(),false);
  await page.locator('#deRecordBtn').click();await page.locator('#deRecordBtn').click();assert.match(await page.locator('#deRecordBtn').innerText(),/Continuar/);
  await page.locator('#deSendBtn').click();await page.waitForFunction(()=>document.getElementById('deConduct').value.includes('Alongamentos'));
  assert.deepEqual(await page.evaluate(()=>testRequests.map(r=>r.mode)),['transcribe','query']);
  assert.equal(await page.locator('#deObjective').inputValue(),'');
  await page.evaluate(()=>testCloudFail=true);await page.getByRole('button',{name:'Salvar evolução',exact:true}).click();await page.waitForFunction(()=>document.getElementById('deAudioStatus').textContent.includes('Não foi possível confirmar'));
  assert.equal(await page.locator('#dailyEvolutionModal').isVisible(),true);
  await page.evaluate(()=>testCloudFail=false);await page.getByRole('button',{name:'Salvar evolução',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('dailyEvolutionModal').classList.contains('show'));
  await page.evaluate(async()=>{patients=[];await loadDB();const id=patients[0].evolucoes[0].id;openDailyEvolutionModal('',id,'synthetic-qa-patient');});
  await page.waitForTimeout(100);assert.equal(await page.locator('#deConduct').inputValue(),'Alongamentos realizados.');
  assert.equal(await page.evaluate(()=>testCloud.data.patients[0].evolucoes.length),1);
  // Exercise the real browser audio decoder and WAV encoder using synthetic audio.
  await page.evaluate(()=>{
   closeModal('dailyEvolutionModal');
   class LongRecorder {
    static isTypeSupported(){return true;}
    constructor(){this.state='inactive';this.mimeType='audio/wav';}
    start(){this.state='recording';} pause(){this.state='paused';} resume(){this.state='recording';}
    stop(){
     this.state='inactive';const rate=16000,n=rate*125,buf=new ArrayBuffer(44+n*2),v=new DataView(buf);
     const put=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};
     put(0,'RIFF');v.setUint32(4,36+n*2,true);put(8,'WAVE');put(12,'fmt ');v.setUint32(16,16,true);
     v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);
     v.setUint16(32,2,true);v.setUint16(34,16,true);put(36,'data');v.setUint32(40,n*2,true);
     setTimeout(()=>{this.ondataavailable?.({data:new Blob([buf],{type:'audio/wav'})});this.onstop?.({});},0);
    }
   }
   window.MediaRecorder=LongRecorder;window.testRequests=[];
   openDailyEvolutionModal('','','synthetic-qa-patient');
  });
  await page.waitForTimeout(100);
  await page.locator('#deRecordBtn').click();await page.locator('#deSendBtn').click();
  await page.waitForFunction(()=>window.testRequests.filter(x=>x.mode==='query').length===1,null,{timeout:30000});
  const longRequests=await page.evaluate(()=>testRequests.map(x=>({mode:x.mode,mime:x.mimeType,size:x.audioBase64?.length,context:x.context})));
  assert.deepEqual(longRequests.map(x=>x.mode),['transcribe','transcribe','transcribe','query']);
  assert.ok(longRequests.slice(0,3).every(x=>x.mime==='audio/wav' && x.size>1000));
  assert.equal((longRequests[3].context.match(/Paciente com dor/g)||[]).length,3);
  await page.screenshot({path:'tests/isabela-v34-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('Browser QA PASS: mobile UI, pause/send, transcript/fill, failed save, retry, persisted record reopened.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

