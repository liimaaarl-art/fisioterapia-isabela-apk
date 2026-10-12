/* Isabela Martins v30 — Gemini como único provedor de IA */
(function(){
  'use strict';

  async function invokeGeminiOnly(mode,question,context){
    if(!window.sb?.functions?.invoke) throw new Error('Serviço Gemini indisponível neste aparelho.');
    const {data,error}=await window.sb.functions.invoke('isabela-ai',{body:{mode,question,context}});
    if(error){
      if(typeof window.describeAIError==='function') throw new Error(await window.describeAIError(error));
      throw error;
    }
    if(!data?.text) throw new Error(data?.error||'O Gemini não retornou texto.');
    return data.text;
  }

  window.invokeIsabelaAI=invokeGeminiOnly;

  const originalPatientAIAction=window.patientAIAction;
  if(typeof originalPatientAIAction==='function'){
    window.patientAIAction=async function(){
      const nativeConfirm=window.confirm;
      window.confirm=function(message){
        const clean=String(message||'')
          .replace(/Cloudflare Workers AI/gi,'Gemini')
          .replace(/Cloudflare/gi,'Gemini');
        return nativeConfirm(clean);
      };
      try{return await originalPatientAIAction.apply(this,arguments);}
      finally{window.confirm=nativeConfirm;}
    };
  }

  function replaceVisibleProviderText(root=document.body){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;
      if(!p||['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
      return /Cloudflare|Workers AI/i.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{node.nodeValue=String(node.nodeValue||'').replace(/Cloudflare Workers AI/gi,'Gemini').replace(/Cloudflare/gi,'Gemini');});
  }

  const oldRenderAI=window.renderAI;
  if(typeof oldRenderAI==='function'){
    window.renderAI=function(){
      const result=oldRenderAI.apply(this,arguments);
      setTimeout(()=>replaceVisibleProviderText(document.getElementById('page')||document.body),0);
      return result;
    };
  }

  const oldRenderNav=window.renderNav;
  if(typeof oldRenderNav==='function'){
    window.renderNav=function(){
      const result=oldRenderNav.apply(this,arguments);
      setTimeout(()=>replaceVisibleProviderText(document.getElementById('nav')||document.body),0);
      return result;
    };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>replaceVisibleProviderText());
  else replaceVisibleProviderText();
})();
