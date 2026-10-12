/* Isabela Martins v29 — Assistente de evolução com Gemini
   Mantém gravação/transcrição existente e acrescenta preenchimento inteligente dos campos.
   Dados clínicos não são salvos automaticamente; o profissional revisa antes de salvar. */
(function(){
  'use strict';

  const FIELD_MAP = {
    vitalSignsInitial: 'deVitalInitial',
    dailyAssessment: 'deDailyAssessment',
    objective: 'deObjective',
    conduct: 'deConduct',
    vitalSignsFinal: 'deVitalFinal',
    observation: 'deObservation'
  };

  function cleanJsonText(text){
    let raw=String(text||'').trim();
    raw=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    const a=raw.indexOf('{'), b=raw.lastIndexOf('}');
    if(a>=0&&b>a) raw=raw.slice(a,b+1);
    return raw;
  }

  function parseEvolutionJson(text){
    const obj=JSON.parse(cleanJsonText(text));
    const out={};
    Object.keys(FIELD_MAP).forEach(k=>{
      const v=obj?.[k];
      out[k]=typeof v==='string'?v.trim():'';
    });
    return out;
  }

  function aiOutput(message,isError=false){
    const out=document.getElementById('deAIResponse');
    if(!out)return;
    out.classList.remove('hidden');
    out.textContent=message;
    out.style.borderColor=isError?'#e3b7b2':'';
    out.style.background=isError?'#fff6f5':'';
  }

  async function callEvolutionOrganizer(raw){
    const question=[
      'Organize o relato abaixo em uma evolução fisioterapêutica estruturada.',
      'Retorne SOMENTE um JSON válido, sem markdown, comentários ou texto fora do JSON, usando exatamente estas chaves:',
      '{"vitalSignsInitial":"","dailyAssessment":"","objective":"","conduct":"","vitalSignsFinal":"","observation":""}',
      'Regras obrigatórias:',
      '- Use somente informações realmente presentes no relato.',
      '- Não invente sinais vitais, diagnósticos, objetivos, condutas, respostas clínicas ou observações.',
      '- Preserve números, unidades, lados do corpo e escalas exatamente quando forem informados.',
      '- Se uma informação não estiver no relato, deixe a chave com string vazia.',
      '- Avaliação do dia: sintomas, queixas, estado funcional, dor, mobilidade e resposta relatada antes/durante a sessão.',
      '- Objetivo: somente o objetivo explicitamente informado; não deduza apenas pela conduta.',
      '- Conduta: procedimentos, exercícios, técnicas e orientações efetivamente realizados.',
      '- Observação: tolerância, intercorrências, orientações ao familiar/cuidador e demais fatos não pertencentes aos outros campos.'
    ].join('\n');

    if(typeof window.invokeIsabelaAI==='function'){
      return await window.invokeIsabelaAI('query',question,raw);
    }
    if(!window.sb?.functions?.invoke) throw new Error('Serviço de IA não disponível neste aparelho.');
    const {data,error}=await window.sb.functions.invoke('isabela-ai',{body:{mode:'query',question,context:raw}});
    if(error) throw error;
    if(!data?.text) throw new Error(data?.error||'A IA não retornou conteúdo.');
    return data.text;
  }

  async function fillEvolutionWithGemini(){
    const raw=document.getElementById('deAIRaw')?.value?.trim()||'';
    if(!raw){
      alert('Primeiro escreva como foi o atendimento ou grave um áudio e faça a transcrição.');
      document.getElementById('deAIRaw')?.focus();
      return;
    }

    const btn=document.getElementById('deGeminiFillBtn');
    const old=btn?.innerHTML;
    if(btn){btn.disabled=true;btn.innerHTML='⏳ Organizando com Gemini…';}
    aiOutput('Gemini está organizando o relato nos campos da evolução…');

    try{
      const text=await callEvolutionOrganizer(raw);
      const data=parseEvolutionJson(text);
      let filled=0,preserved=0,empty=0;
      for(const [key,id] of Object.entries(FIELD_MAP)){
        const el=document.getElementById(id), value=data[key];
        if(!el)continue;
        if(!value){empty++;continue;}
        if(el.value.trim()){
          preserved++;
          continue;
        }
        el.value=value;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        filled++;
      }
      const parts=[`${filled} campo${filled===1?'':'s'} preenchido${filled===1?'':'s'} pela IA`];
      if(preserved)parts.push(`${preserved} já preenchido${preserved===1?' foi preservado':'s foram preservados'}`);
      if(empty)parts.push('o que não foi informado ficou em branco');
      aiOutput(`✓ ${parts.join(' • ')}. Revise antes de salvar.`);
    }catch(err){
      console.error('Gemini evolution fill:',err);
      aiOutput('Não foi possível preencher os campos com a IA agora. O texto digitado/gravado foi preservado para você tentar novamente.',true);
      alert('Não consegui organizar a evolução com a IA agora. Confira a conexão e tente novamente.');
    }finally{
      if(btn){btn.disabled=false;btn.innerHTML=old||'✨ Preencher evolução com Gemini';}
    }
  }

  function enhanceEvolutionAssistant(){
    const box=document.querySelector('#dailyEvolutionModal .ai-evolution-box');
    if(!box||box.dataset.v29==='1')return;
    box.dataset.v29='1';

    const title=box.querySelector('.ai-title');
    if(title) title.textContent='✨ Evolução inteligente com Gemini';

    const helper=box.querySelector('.helper');
    if(helper){
      helper.innerHTML='<b>Escolha o jeito mais rápido:</b> escreva livremente ou grave o atendimento. Depois toque em <b>Preencher evolução com Gemini</b>. A IA organiza apenas o que você informou e você revisa antes de salvar.';
    }

    const raw=document.getElementById('deAIRaw');
    if(raw){
      raw.placeholder='✍️ Escreva como se estivesse contando o atendimento. Ex.: Paciente chegou com dor lombar 6/10. PA 120x80, FC 78, SpO₂ 97%. Objetivo foi reduzir dor e melhorar mobilidade. Realizados alongamentos, mobilização e treino de marcha. Tolerou bem, sem intercorrências.';
      raw.style.minHeight='150px';
      if(!document.getElementById('deTextModeLabel')){
        raw.insertAdjacentHTML('beforebegin','<div id="deTextModeLabel" class="v29-input-title">✍️ Digitar ou editar o relato</div>');
      }
    }

    const record=document.getElementById('deRecordBtn');
    if(record && !record.textContent.includes('Gravar atendimento')) record.innerHTML='🎙️ Gravar atendimento';
    const finish=document.getElementById('deFinishBtn');
    if(finish) finish.innerHTML='⏹ Parar gravação';
    const send=document.getElementById('deSendBtn');
    if(send) send.innerHTML='✨ Transcrever áudio';

    const actions=box.querySelector('.ai-evolution-actions');
    if(actions){
      actions.innerHTML='<button class="btn ai-dark v29-gemini-main" id="deGeminiFillBtn" type="button" onclick="fillEvolutionWithGemini()">✨ Preencher evolução com Gemini</button><button class="btn" type="button" onclick="speakEvolutionText()">🔊 Ler texto</button><button class="btn" type="button" onclick="clearEvolutionDraft()">Limpar relato</button>';
    }

    const steps=box.querySelector('.voice-steps');
    if(steps) steps.style.display='none';

    if(!document.getElementById('v29EvolutionStyle')){
      const style=document.createElement('style');
      style.id='v29EvolutionStyle';
      style.textContent=`
        .ai-evolution-box{border:1px solid rgba(116,133,109,.28);border-radius:16px;padding:14px;background:linear-gradient(180deg,#fffefb,#f7f7f1)}
        .v29-input-title{font-size:10px;font-weight:850;color:var(--pri);margin:12px 0 6px;text-transform:uppercase;letter-spacing:.035em}
        .ai-evolution-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:9px}
        .v29-gemini-main{flex:1 1 260px;min-height:44px;font-size:12px!important}
        #deAIRaw{background:#fff;border:1px solid #d6ddd2;line-height:1.55}
        #deAIResponse{margin-top:10px;white-space:pre-wrap}
        @media(max-width:600px){.voice-actions{display:grid!important;grid-template-columns:1fr}.voice-actions .btn{width:100%}.v29-gemini-main{width:100%}}
      `;
      document.head.appendChild(style);
    }
  }

  window.fillEvolutionWithGemini=fillEvolutionWithGemini;

  const oldOpen=window.openDailyEvolutionModal;
  if(typeof oldOpen==='function'){
    window.openDailyEvolutionModal=function(){
      const r=oldOpen.apply(this,arguments);
      setTimeout(enhanceEvolutionAssistant,0);
      return r;
    };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',enhanceEvolutionAssistant);
  else enhanceEvolutionAssistant();
})();
