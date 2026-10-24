/* Isabela v34: um envio transcreve e preenche; revisão antes de salvar. */
(function(){
  'use strict';
  const MAX_AUDIO=20*1024*1024;
  const fields={vitalSignsInitial:'deVitalInitial',dailyAssessment:'deDailyAssessment',objective:'deObjective',conduct:'deConduct',vitalSignsFinal:'deVitalFinal',observation:'deObservation'};
  const $=id=>document.getElementById(id);
  const value=id=>$(id)?.value||'';
  const controllers={};
  let draftDBPromise,saveBusy=false;

  // Observe transaction aborts as well as request errors; do not leave Save pending.
  window.saveDB=function(){return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORES,'readwrite');
    tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Falha ao salvar no aparelho.'));
    STORES.forEach(n=>tx.objectStore(n).clear());
    patients.forEach(p=>{
      const core={...p};delete core.observacoes;delete core.evolucoes;delete core.relatorios;
      tx.objectStore('patients').put(core);
      for(const kind of ['observacoes','evolucoes','relatorios'])for(const e of p[kind]||[])tx.objectStore(kind).put({...e,patientId:p.id});
    });
    for(const [store,items] of Object.entries({agenda:appointments,assessments,templates,recurrences,finance,categories,professionals}))for(const item of items)tx.objectStore(store).put(item);
    tx.objectStore('settings').put({key:'version',value:9});
  });};

  function draftDB(){
    if(!draftDBPromise)draftDBPromise=new Promise((resolve,reject)=>{
      const r=indexedDB.open('isabela_audio_drafts_v34',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'key'});
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    }).catch(e=>{draftDBPromise=null;throw e;});
    return draftDBPromise;
  }
  async function draftStore(action,key,data){
    const d=await draftDB();
    return new Promise((resolve,reject)=>{
      const tx=d.transaction('drafts',action==='get'?'readonly':'readwrite'),s=tx.objectStore('drafts');
      const r=action==='put'?s.put(data):action==='delete'?s.delete(key):s.get(key);
      tx.oncomplete=()=>resolve(r.result);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Falha na cópia local do rascunho.'));
    });
  }
  function context(kind){
    if(!currentUser?.id)return '';
    return JSON.stringify(kind==='evolution'
      ?[currentUser.id,kind,value('dePatient'),dailyEvolutionAppointmentId,editingDailyEvolutionId,value('deDate')]
      :[currentUser.id,kind,selectedPatientId,entryType,editingEntryId,value('eDate')]);
  }
  function status(c,msg,error=false){
    (c.kind==='evolution'?setEvolutionAudioStatus:setReportAudioStatus)(msg,error?'error':'ready');
  }
  function controller(kind){
    return controllers[kind]||(controllers[kind]={kind,rec:null,stream:null,chunks:[],blob:null,transcript:'',applied:false,busy:false,starting:false,key:'',write:Promise.resolve(),timer:null});
  }
  function ids(c){return c.kind==='evolution'?['deRecordBtn','deFinishBtn','deSendBtn','dailyEvolutionModal']:['reportRecordBtn','reportFinishBtn','reportSendBtn','entryModal'];}
  function rawId(c){return c.kind==='evolution'?'deAIRaw':'eText';}
  function snapshot(c){
    const data={key:c.key,blob:c.blob,transcript:c.transcript,applied:c.applied,generated:c.generated||{},values:{},updatedAt:Date.now()};
    const list=c.kind==='evolution'?['dePatient','deDate','deAIRaw',...Object.values(fields)]:['eDate','eTitle','eText'];
    list.forEach(id=>data.values[id]=value(id));
    return data;
  }
  function backup(c){
    if(!c.key||context(c.kind)!==c.key)return Promise.resolve(false);
    const data=snapshot(c);
    // Serialize puts/deletes so an older write cannot resurrect a saved draft.
    c.write=c.write.catch(()=>{}).then(()=>draftStore('put',data.key,data));
    return c.write;
  }
  function backupLater(c){
    clearTimeout(c.timer);c.timer=setTimeout(()=>backup(c).catch(()=>status(c,'Não foi possível manter a cópia local. Mantenha esta tela aberta e tente salvar.',true)),350);
  }
  function buttons(c){
    const [rec,fin,send,modal]=ids(c),state=c.rec?.state;
    if($(rec)){$(rec).textContent=state==='recording'?'⏸ Pausar':state==='paused'?'▶ Continuar':'🎙 Gravar';$(rec).disabled=c.busy||c.starting||saveBusy;}
    if($(fin)){$(fin).hidden=true;$(fin).style.display='none';}
    if($(send)){$(send).textContent=c.failed?'↻ Tentar novamente':'✨ Enviar';$(send).disabled=c.busy||c.starting||saveBusy||!(c.blob||c.rec||value(rawId(c)).trim());}
    $(modal)?.querySelectorAll('.modal-foot .primary').forEach(b=>b.disabled=c.busy||c.starting||saveBusy||!!c.rec);
    if(c.kind==='evolution'){
      if($('deGeminiFillBtn')){$('deGeminiFillBtn').hidden=true;$('deGeminiFillBtn').style.display='none';}
      if($('dePatient'))$('dePatient').disabled=!!dailyEvolutionAppointmentId||c.busy||c.starting||!!c.rec||!!c.blob;
    }
  }
  async function bind(kind){
    const c=controller(kind),key=context(kind);if(!key)return;
    if(c.key===key){buttons(c);return;}
    c.key=key;c.blob=null;c.transcript='';c.applied=false;c.failed=false;c.generated={};
    const baseline=snapshot(c).values;
    try{
      const old=await draftStore('get',key);
      if(c.key!==key||context(kind)!==key)return;
      // Do not overwrite anything typed while IndexedDB was loading.
      if(old&&JSON.stringify(snapshot(c).values)===JSON.stringify(baseline)){
        for(const [id,v] of Object.entries(old.values||{}))if($(id))$(id).value=v;
        c.blob=old.blob;c.transcript=old.transcript||'';c.applied=!!old.applied;c.generated=old.generated||{};
        status(c,'Rascunho recuperado neste aparelho. Você pode continuar ou enviar.');
      }
    }catch{status(c,'Cópia local indisponível. Mantenha a tela aberta até salvar.',true);}
    buttons(c);
  }
  async function toggle(kind){
    const c=controller(kind);if(c.busy||c.starting||saveBusy)return;
    if(c.rec){
      if(c.rec.state==='recording'){c.rec.pause();status(c,'Gravação pausada. Continue ou toque em Enviar.');}
      else if(c.rec.state==='paused'){c.rec.resume();status(c,'Gravando… fale normalmente.');}
      buttons(c);return;
    }
    if(c.blob&&!confirm('Há um áudio guardado. Deseja substituí-lo por uma nova gravação?'))return;
    c.starting=true;buttons(c);
    try{
      await bind(kind);stopLiveDictation(kind,true);
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Gravação indisponível. Permita o microfone no aplicativo.');
      c.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      c.rec=new MediaRecorder(c.stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:32000});
      c.chunks=[];c.blob=null;c.transcript='';c.applied=false;c.failed=false;c.limit=false;
      const recorder=c.rec;
      c.rec.ondataavailable=e=>{
        if(e.data?.size)c.chunks.push(e.data);
        c.blob=new Blob(c.chunks,{type:recorder.mimeType||mime||'audio/webm'});
        backupLater(c);
        if(c.blob.size>=MAX_AUDIO-128*1024&&recorder.state!=='inactive'){
          c.limit=true;recorder.stop();status(c,'Gravação concluída no limite de tamanho. Toque em Enviar.');
        }
      };
      c.rec.onstop=()=>{
        c.blob=new Blob(c.chunks,{type:recorder.mimeType||mime||'audio/webm'});
        c.chunks=[];c.stream?.getTracks().forEach(t=>t.stop());c.stream=null;c.rec=null;
        backup(c).catch(()=>status(c,'Áudio mantido nesta tela, mas a cópia local falhou.',true));buttons(c);
      };
      c.rec.onerror=()=>{status(c,'A gravação foi interrompida. O trecho capturado foi mantido para envio.',true);if(recorder.state!=='inactive')recorder.stop();};
      c.rec.start(5000);status(c,'Gravando… fale normalmente. Pause se precisar e toque em Enviar.');
    }catch(e){c.stream?.getTracks().forEach(t=>t.stop());c.stream=null;c.rec=null;status(c,microphoneError(e),true);}
    finally{c.starting=false;buttons(c);}
  }
  function stop(c){
    if(!c.rec)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const recorder=c.rec,previous=recorder.onstop;
      recorder.onstop=e=>{previous(e);resolve();};
      try{recorder.stop();}catch(e){reject(e);}
    });
  }
  async function invoke(body){
    const {data,error}=await sb.functions.invoke('isabela-ai',{body,timeout:150000});
    if(error)throw new Error(await describeAIError(error));
    if(!data?.text?.trim())throw new Error(data?.error||'A IA retornou uma resposta vazia.');
    return data.text.trim();
  }
  async function send(kind){
    const c=controller(kind);if(c.busy||c.starting||saveBusy)return;
    c.busy=true;c.failed=false;buttons(c);
    const key=c.key;
    try{
      status(c,'Preparando áudio…');await stop(c);
      if(!key||context(kind)!==key)throw new Error('O paciente ou a data mudou. Reabra o atendimento para continuar.');
      if(c.blob&&!c.transcript){
        if(!c.blob.size)throw new Error('O áudio está vazio. Grave novamente.');
        if(c.blob.size>MAX_AUDIO)throw new Error('O áudio ultrapassa 20 MB. O arquivo foi preservado. Escolha um áudio menor.');
        status(c,'Enviando áudio e transcrevendo…');
        c.transcript=await invoke({mode:'transcribe',audioBase64:await blobBase64Raw(c.blob),mimeType:c.blob.type||'audio/webm'});
      }
      if(context(kind)!==key)throw new Error('O atendimento mudou. O áudio permanece no rascunho original.');
      const raw=$(rawId(c));
      if(c.transcript&&!c.applied){raw.value=[raw.value.trim(),c.transcript].filter(Boolean).join('\n\n');c.applied=true;raw.dispatchEvent(new Event('input',{bubbles:true}));}
      if(!raw.value.trim())throw new Error('Grave um áudio ou escreva o relato antes de enviar.');
      await backup(c).catch(()=>{});
      if(kind==='evolution'){
        status(c,'Preenchendo os campos da evolução…');
        const question='Organize o relato em evolução fisioterapêutica. Retorne SOMENTE JSON com as chaves vitalSignsInitial, dailyAssessment, objective, conduct, vitalSignsFinal, observation, todas strings. Use exclusivamente os fatos explicitamente relatados. Preserve números, unidades, lateralidade e escalas. Não deduza objetivos nem diagnósticos. Informação ausente deve ser string vazia; indique trechos ambíguos em observation para revisão.';
        const text=await invoke({mode:'query',question,context:raw.value.trim()});
        const data=JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim());
        if(!data||Array.isArray(data)||Object.keys(fields).some(k=>typeof data[k]!=='string'))throw new Error('A IA retornou campos inválidos. Seu relato foi preservado.');
        if(context(kind)!==key)throw new Error('O atendimento mudou. Reabra o rascunho original.');
        for(const [k,id] of Object.entries(fields))if((!value(id).trim()||value(id)===c.generated?.[id])&&data[k].trim()){$(id).value=data[k].trim();(c.generated||={})[id]=$(id).value;$(id).dispatchEvent(new Event('input',{bubbles:true}));}
      }
      await backup(c).catch(()=>{});
      status(c,kind==='evolution'?'✓ Transcrição e preenchimento concluídos. Revise os campos e toque em Salvar evolução.':'✓ Áudio transcrito no relatório. Revise o texto e toque em Salvar.');
    }catch(e){c.failed=true;status(c,(e.message||'Não foi possível processar.')+' O áudio e o texto foram mantidos. Toque em Tentar novamente.',true);}
    finally{c.busy=false;buttons(c);}
  }
  function reset(kind){
    const c=controller(kind);clearTimeout(c.timer);
    if(c.rec){c.rec.ondataavailable=null;c.rec.onstop=null;try{c.rec.stop();}catch{}}
    c.stream?.getTracks().forEach(t=>t.stop());c.rec=null;c.stream=null;c.chunks=[];c.blob=null;c.transcript='';c.applied=false;c.key='';c.failed=false;c.generated={};
    buttons(c);
  }
  async function confirmedPersist(){
    let localError;
    try{if(db)await saveDB();else localStorage.setItem(fallbackKey(),JSON.stringify(statePayload()));}catch(e){localError=e;}
    syncing=true;updateStorage();
    try{
      if(!currentUser?.id)throw new Error('Entre novamente para salvar na nuvem.');
      const now=new Date().toISOString();
      const {data,error}=await sb.from('app_state').upsert({user_id:currentUser.id,data:statePayload(),updated_at:now},{onConflict:'user_id'}).select('user_id,updated_at').single();
      if(error)throw error;
      if(data?.user_id!==currentUser.id)throw new Error('O banco não confirmou o salvamento.');
      cloudReady=true;storageMode='supabase';lastCloudSync=data.updated_at;
    }catch(e){
      cloudReady=false;storageMode='local-cache';
      throw new Error((e.message||'Falha de conexão.')+(localError?' A cópia local também falhou. Mantenha esta tela aberta.':' Há uma cópia local neste aparelho.'));
    }finally{syncing=false;updateStorage();}
  }
  async function save(kind){
    const c=controller(kind);if(saveBusy||c.busy||c.starting)return;
    if(c.rec||c.blob&&!c.applied){status(c,'Toque em Enviar para processar o áudio antes de salvar.',true);return;}
    const pid=kind==='evolution'?value('dePatient'):selectedPatientId,p=patientById(pid);
    if(!p){alert('Selecione o paciente.');return;}
    saveBusy=true;Object.values(controllers).forEach(buttons);
    let saved=false;
    try{
      const now=new Date().toISOString();
      if(kind==='evolution'){
        const obj={appointmentId:dailyEvolutionAppointmentId||'',date:value('deDate')||today(),title:'Evolução diária',vitalSignsInitial:value('deVitalInitial').trim(),dailyAssessment:value('deDailyAssessment').trim(),treatmentObjective:value('deObjective').trim(),conductPerformed:value('deConduct').trim(),vitalSignsFinal:value('deVitalFinal').trim(),observation:value('deObservation').trim(),attachments:clone(pendingDailyEvolutionAttachments),updatedAt:now};
        obj.text=evolutionText(obj);if(!obj.text.trim())throw new Error('Preencha a evolução antes de salvar.');
        if(!editingDailyEvolutionId)editingDailyEvolutionId=uid();
        const current=findEvolutionById(editingDailyEvolutionId);
        if(current&&current.patient.id!==pid)current.patient.evolucoes=current.patient.evolucoes.filter(e=>e.id!==editingDailyEvolutionId);
        p.evolucoes=p.evolucoes||[];
        let record=p.evolucoes.find(e=>e.id===editingDailyEvolutionId);
        if(record)Object.assign(record,obj);else{record={id:editingDailyEvolutionId,createdAt:now,...obj};p.evolucoes.push(record);}
        const a=appointments.find(a=>a.id===dailyEvolutionAppointmentId),pro=a?.professionalId||p.professionalId||professionals[0]?.id||'';
        record.professionalId=pro;record.clinicalFormVersion='v34';
        const professional=professionalById(pro);
        if(professional)record.professionalSnapshot={id:professional.id,name:professional.name,profession:professional.profession||'Fisioterapeuta',registry:professional.registry||''};
        if(a){a.status='Realizado';if(!a.paymentStatus)a.paymentStatus='Não pago';a.updatedAt=now;syncAppointmentFinance(a);}
      }else{
        const obj={date:value('eDate')||today(),title:value('eTitle').trim(),text:value('eText').trim(),attachments:clone(pendingAttachments),updatedAt:now};
        if(!obj.text&&!obj.attachments.length)throw new Error('Preencha o registro antes de salvar.');
        if(!editingEntryId)editingEntryId=uid();
        p[entryType]=p[entryType]||[];const record=p[entryType].find(e=>e.id===editingEntryId);
        if(record)Object.assign(record,obj);else p[entryType].push({id:editingEntryId,...obj});
      }
      // Keep retry IDs in memory; retain the original recovery key until confirmation.
      status(c,'Salvando e aguardando confirmação do banco…');
      await confirmedPersist();saved=true;
      clearTimeout(c.timer);await c.write.catch(()=>{});await draftStore('delete',c.key).catch(()=>{});c.key='';
      selectedPatientId=pid;
    }catch(e){status(c,'Não foi possível confirmar o salvamento. '+(e.message||'Tente novamente.')+' Revise e toque em Salvar novamente.',true);}
    finally{saveBusy=false;Object.values(controllers).forEach(buttons);}
    if(saved){closeModal(ids(c)[3]);render();if(typeof syncAppointmentReminders==='function')syncAppointmentReminders();alert('Salvo com sucesso na nuvem.');}
  }
  // Replace the legacy recorder without starting a competing SpeechRecognition session.
  window.toggleEvolutionRecording=()=>toggle('evolution');window.toggleReportRecording=()=>toggle('report');
  window.sendEvolutionRecordingToAI=()=>send('evolution');window.sendReportRecordingToAI=()=>send('report');
  window.finishEvolutionRecording=()=>stop(controller('evolution'));window.finishReportRecording=()=>stop(controller('report'));
  window.resetEvolutionRecording=()=>reset('evolution');window.resetReportRecording=()=>reset('report');
  window.updateEvolutionAudioButtons=()=>buttons(controller('evolution'));window.updateReportAudioButtons=()=>buttons(controller('report'));
  window.handleReportAudioFile=async input=>{const c=controller('report');if(c.busy||c.starting||saveBusy)return;await bind('report');const f=input?.files?.[0];if(f){c.blob=f;c.transcript='';c.applied=false;await backup(c).catch(()=>{});status(c,'Áudio selecionado. Toque em Enviar.');buttons(c);}input.value='';};
  window.saveDailyEvolution=()=>save('evolution');window.saveEntry=()=>save('report');
  window.fillEvolutionWithGemini=()=>send('evolution');
  const originalClose=window.closeModal;
  window.closeModal=function(id){
    const c=id==='dailyEvolutionModal'?controller('evolution'):id==='entryModal'?controller('report'):null;
    if(c){
      if(c.busy||c.starting||saveBusy){status(c,'Aguarde a conclusão antes de fechar.',true);return;}
      // Capture text before releasing the recorder. Preserve the original patient context.
      if(c.rec){stop(c).then(()=>backup(c)).then(()=>originalClose(id)).catch(()=>status(c,'Não foi possível guardar o áudio. Mantenha esta tela aberta.',true));return;}
      if(c.key)backup(c).catch(()=>{});
    }
    return originalClose(id);
  };
  window.clearEvolutionDraft=async function(){
    const c=controller('evolution');if(c.busy||c.starting||saveBusy)return;
    if(!confirm('Limpar o relato e o áudio deste rascunho? Os campos preenchidos serão mantidos.'))return;
    await stop(c);c.blob=null;c.transcript='';c.applied=false;$('deAIRaw').value='';await backup(c).catch(()=>{});status(c,'Relato limpo.');buttons(c);
  };
  function enhance(){
    for(const kind of ['evolution','report']){
      const c=controller(kind),modal=$(ids(c)[3]);if(!modal)continue;
      const box=kind==='evolution'?modal.querySelector('.ai-evolution-box'):$('reportAudioTools');
      const helper=box?.querySelector('.helper');if(helper)helper.textContent='Grave falando naturalmente. Pause e continue se precisar. Enviar transcreve e '+(kind==='evolution'?'preenche os campos automaticamente.':'adiciona o texto ao relatório.')+' Revise antes de salvar.';
      box?.querySelectorAll('.voice-steps').forEach(el=>el.hidden=true);
      if(kind==='evolution'&&box?.querySelector('.ai-title'))box.querySelector('.ai-title').textContent='✨ Evolução por áudio';
      buttons(c);
      if(modal.classList.contains('show'))bind(kind);
    }
  }
  // Older enhancements run after opening a modal; apply this last.
  const oldOpen=window.openDailyEvolutionModal,oldEntry=window.openEntryModal;
  window.openDailyEvolutionModal=function(){const r=oldOpen.apply(this,arguments);setTimeout(enhance,0);return r;};
  window.openEntryModal=function(){const r=oldEntry.apply(this,arguments);setTimeout(enhance,0);return r;};
  document.addEventListener('input',e=>{for(const c of Object.values(controllers))if($(ids(c)[3])?.contains(e.target)){backupLater(c);buttons(c);}});
  document.addEventListener('change',e=>{if(['dePatient','deDate','eDate'].includes(e.target.id)){const c=controller(e.target.id==='eDate'?'report':'evolution');if(c.blob||c.rec){status(c,'Volte ao paciente e à data originais para continuar este áudio.',true);return;}bind(c.kind);}});
  window.addEventListener('pagehide',()=>Object.values(controllers).forEach(c=>backup(c).catch(()=>{})));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();
