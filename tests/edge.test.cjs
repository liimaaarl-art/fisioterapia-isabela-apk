const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/isabela-ai/index.ts','utf8'));
function edge(){
 let handler;const calls=[];
 const ctx={Request,Response,Blob,FormData,Uint8Array,AbortSignal,Set,JSON,Number,String,Math,atob,console:{log(){},error(){}},setTimeout,
 Deno:{env:{get:k=>({GROQ_API_KEY:'test-only-key',SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test-anon'})[k]},serve:f=>handler=f},
 fetch:async(url,options)=>{calls.push({url,options});if(url.endsWith('/auth/v1/user'))return Response.json({id:'test-user'});if(url.endsWith('/audio/transcriptions'))return Response.json({text:'Relato clínico fictício.'});throw Error('Unexpected request');}};
 vm.runInNewContext(source,ctx);return{calls,invoke:body=>handler(new Request('https://test/ai',{method:'POST',headers:{Authorization:'Bearer test-only-jwt','Content-Type':'application/json'},body:JSON.stringify(body)})),handler:()=>handler};
}
test('authenticated status advertises 20 MB; legacy transcribe contract still works',async()=>{
 const e=edge();const status=await(await e.invoke({mode:'status'})).json();assert.equal(status.maxAudioBytes,20*1024*1024);assert.equal(status.provider,'groq');
 const audio=Buffer.alloc(6*1024*1024,1).toString('base64');const response=await e.invoke({mode:'transcribe',audioBase64:audio,mimeType:'audio/webm;codecs=opus'});assert.equal(response.status,200);assert.equal((await response.json()).text,'Relato clínico fictício.');assert.equal(e.calls.at(-1).options.body.get('file').size,6*1024*1024);
});
test('oversized and invalid audio is rejected before contacting audio provider',async()=>{
 const e=edge();const response=await e.invoke({mode:'transcribe',audioBase64:Buffer.alloc(20*1024*1024+1).toString('base64'),mimeType:'audio/webm'});assert.equal(response.status,413);assert.equal(e.calls.filter(c=>c.url.includes('groq')).length,0);
 const invalid=await e.invoke({mode:'transcribe',audioBase64:'invalid',mimeType:'audio/webm'});assert.equal(invalid.status,400);
});
test('auth and CORS remain enforced',async()=>{
 const e=edge(),handler=e.handler();assert.equal((await handler(new Request('https://test/ai',{method:'POST',body:'{}'}))).status,401);assert.equal((await handler(new Request('https://test/ai',{method:'OPTIONS'}))).status,204);
});
