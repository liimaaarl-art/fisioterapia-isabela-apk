/* Isabela Martins v31 — Gemini resiliente e mensagens de erro claras */
(function(){
  'use strict';

  const FIELD_MAP={
    vitalSignsInitial:'deVitalInitial',
    dailyAssessment:'deDailyAssessment',
    objective:'deObjective',
    conduct:'deConduct',
    vitalSignsFinal:'deVitalFinal',
    observation:'deObservation'
  };

  async function describeGeminiError(error){
    const response=error?.context;
    const status=Number(response?.status||error?.status||0);
    let detail='';
    if(response){
      try{
        const clone=typeof response.clone==='function'?response.clone():response;
        const body=await clone.json();
        detail=String(body?.error||body?.message||'').trim();
      }catch(_){
        try{
          const clone=typeof response.clone==='function'?response.clone():response;
          detail=String(await clone.text()).trim();
        }catch(__){}
      }
    }
    if(detail) return detail;
    const original=String(error?.message||'').trim();
    if(status===429||/429|quota|rate.?limit|limite/i.test(original)) return 'Limite do Gemini atingido. Aguarde a renovação da cota ou alguns minutos e tente novamente.';
    if(status===401||status===403||/api.?key|credencial|unauthorized|forbidden/i.test(original)) return 'Erro de configuração do Gemini. A credencial foi recusada; confira a GEMINI_API_KEY no Supabase.';
    if(status===503||status===502||status===504||/timeout|temporariamente|indispon/i.test(original)) return 'Gemini temporariamente indisponível. O servidor já tentou novamente automaticamente. Tente outra vez em instantes.';
    return original||'Não foi possível comunicar com o Gemini. Tente novamente.';
  }

  window.describeAIError=describeGeminiError;

  async function invokeGemini(mode,question,context){
    if(typeof sb==='undefined'||!sb?.functions?.invoke) throw new Error('Serviço do Gemini não disponível neste aparelho.');
    const {data,error}=await sb.functions.invoke('isabela-ai',{body:{mode,question,context}});
    if(error) throw new Error(await describeGeminiError(error));
    if(!data?.text) throw new Error(data?.error||'O Gemini não retornou conteúdo.');
    return data.text;
  }
  window.invokeIsabelaAI=invokeGemini;

  function cleanJsonText(text){
    let raw=String(text||'').trim();
    raw=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
    if(a>=0&&b>a) raw=raw.slice(a,b+1);
    return raw;
  }
  function parseEvolutionJson(text){
    const obj=JSON.parse(cleanJsonText(text));
    const out={};
    Object.keys(FIELD_MAP).forEach(k=>{out[k]=typeof obj?.[k]==='string'?obj[k].trim():'';});
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
  function friendlyError(err){
    const m=String(err?.message||err||'').trim();
    if(/limite do gemini|429|quota|rate.?limit/i.test(m)) return 'Limite do Gemini atingido. Aguarde a renovação da cota ou alguns minutos e tente novamente.';
    if(/configuração do gemini|credencial|api.?key|401|403/i.test(m)) return 'Erro de configuração do Gemini. A chave de acesso precisa ser conferida no Supabase.';
    if(/temporariamente indisponível|502|503|504|timeout|demorou/i.test(m)) return 'Gemini temporariamente indisponível. O sistema já tentou novamente automaticamente. Tente outra vez em instantes.';
    return m||'Não foi possível usar o Gemini agora. Tente novamente.';
  }

  async function fillEvolutionWithGeminiV31(){
    const raw=document.getElementById('deAIRaw')?.value?.trim()||'';
    if(!raw){
      alert('Primeiro escreva como foi o atendimento ou grave um áudio e faça a transcrição.');
      document.getElementById('deAIRaw')?.focus();
      return;
    }
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

    const btn=document.getElementById('deGeminiFillBtn');
    const old=btn?.innerHTML;
    if(btn){btn.disabled=true;btn.innerHTML='⏳ Organizando com Gemini…';}
    aiOutput('Gemini está organizando o relato nos campos da evolução…');
    try{
      const text=await invokeGemini('query',question,raw);
      const data=parseEvolutionJson(text);
      let filled=0,preserved=0,empty=0;
      for(const [key,id] of Object.entries(FIELD_MAP)){
        const el=document.getElementById(id),value=data[key];
        if(!el)continue;
        if(!value){empty++;continue;}
        if(el.value.trim()){preserved++;continue;}
        el.value=value;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        filled++;
      }
      const parts=[`${filled} campo${filled===1?'':'s'} preenchido${filled===1?'':'s'} pelo Gemini`];
      if(preserved)parts.push(`${preserved} já preenchido${preserved===1?' foi preservado':'s foram preservados'}`);
      if(empty)parts.push('o que não foi informado ficou em branco');
      aiOutput(`✓ ${parts.join(' • ')}. Revise antes de salvar.`);
    }catch(err){
      console.error('Gemini evolution fill:',err);
      const message=friendlyError(err);
      aiOutput(message,true);
      alert(message);
    }finally{
      if(btn){btn.disabled=false;btn.innerHTML=old||'✨ Preencher evolução com Gemini';}
    }
  }
  window.fillEvolutionWithGemini=fillEvolutionWithGeminiV31;

  function renameLegacyProvider(root=document){
    const walker=document.createTreeWalker(root.body||root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{
      if(n.nodeValue?.includes('Cloudflare Workers AI')) n.nodeValue=n.nodeValue.replaceAll('Cloudflare Workers AI','Gemini');
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>renameLegacyProvider());
  else renameLegacyProvider();
})();
