const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const line=fs.readFileSync('index.html','utf8').split('\n').find(x=>x.startsWith('async function enterAuthenticatedApp(user)'));
assert.ok(line,'entry function exists');
function setup({readFails=false,found=true}={}){
 const elements=new Map(), calls=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{style:{},textContent:''});return elements.get(id);};
 const ctx={document:{getElementById:el},currentUser:null,cloudReady:false,storageMode:'',console:{error(){}},
  async loadLocalCache(){calls.push('load-local');return true;},async loadCloudState(){calls.push('load-cloud');if(readFails)throw Error('network');return found;},
  seed(){calls.push('seed');},async saveCloudState(){calls.push('save-cloud');},async saveLocalCache(){calls.push('save-local');},updateStorage(){},render(){}};
 vm.createContext(ctx);vm.runInContext(line,ctx);return {ctx,calls,el};
}
test('failed cloud read cannot overwrite cloud or initialize empty records',async()=>{
 const s=setup({readFails:true});await assert.rejects(s.ctx.enterAuthenticatedApp({email:'test@example.com'}),/Nenhuma alteração foi enviada/);
 assert.deepEqual(s.calls,['load-local','load-cloud']);assert.equal(s.el('authScreen').style.display,'flex');assert.equal(s.el('appShell').style.display,'none');assert.match(s.el('authMsg').textContent,/tente entrar novamente/);
});
test('existing state is loaded without writing a replacement to the cloud',async()=>{
 const s=setup({found:true});await s.ctx.enterAuthenticatedApp({email:'test@example.com'});
 assert.deepEqual(s.calls,['load-local','load-cloud','seed','save-local']);assert.equal(s.el('appShell').style.display,'grid');
});
test('an actual empty account still initializes normally',async()=>{
 const s=setup({found:false});await s.ctx.enterAuthenticatedApp({email:'test@example.com'});
 assert.deepEqual(s.calls,['load-local','load-cloud','seed','save-cloud','save-local']);
});
