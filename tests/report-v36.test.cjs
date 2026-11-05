const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('isabela_v36_reports.js','utf8');

function setup(){
  const els = {};
  function fakeEl(id=''){
    return {
      id, value:'', checked:false, disabled:false, textContent:'', events:{},
      classList:{contains(){return true}, add(){}, remove(){}},
      addEventListener(name, cb){this.events[name]=cb;},
      appendChild(){}, insertBefore(){}, querySelector(){return null;},
      querySelectorAll(selector){
        if(this.id==='is36Dates' && selector.startsWith('input'))
          return selector.endsWith(':checked') ? (this.inputs||[]).filter(x=>x.checked) : (this.inputs||[]);
        return [];
      },
      set innerHTML(x){
        this._html=x;
        if(this.id==='is36Dates')
          this.inputs=[...x.matchAll(/type="checkbox" value="([^"]+)"/g)].map(a=>Object.assign(fakeEl(),{value:a[1]}));
      },
      get innerHTML(){return this._html||'';}
    };
  }
  const ctx={
    document:{
      head:{appendChild(){}}, body:{appendChild(e){els[e.id]=e;}},
      createElement(){return fakeEl();},
      getElementById(id){return els[id]||(els[id]=fakeEl(id));},
      querySelectorAll(){return [];}
    },
    patients:[{id:'p1',name:'Paciente <teste>',professionalId:'pro',
      initial:'Contexto prévio',relatorios:[],evolucoes:[
        {id:'e1',date:'2020-01-02',dailyAssessment:'Primeiro atendimento'},
        {id:'e2',date:'2020-01-03',conductPerformed:'Conduta <indevida>'}
      ]}],
    appointments:[
      {patientId:'p1',status:'Realizado',date:'2020-01-02'},
      {patientId:'p1',status:'Realizado',date:'2020-01-03'},
      {patientId:'p1',status:'Cancelado',date:'2020-01-04'}
    ],
    professionals:[{id:'pro',name:'Fisioterapeuta QA',registry:'CREFITO TESTE'}],
    selectedPatientId:'p1',patientTab:'dados',cloudReady:true,storageMode:'supabase',
    generatePatientAIReport(){},renderPatientDetail(){},openModal(){},closeModal(){},
    uid(){return 'report1';},
    async persist(){ctx.persistCalled=true;},
    render(){ctx.renderCalled=true;},
    alert(x){ctx.alertText=x;},confirm(){return true;},
    window:{open(){return {document:{open(){},write(x){ctx.printed=x;},close(){}},focus(){},setTimeout(){}}}},
    invokeIsabelaAI:async()=>{ctx.aiCalled=true;return 'Texto sintético da IA';}
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  ctx.generatePatientAIReport('p1');
  return {ctx,els};
}
test('abre com seleção vazia, sem disparar IA automaticamente',()=>{
  const {ctx,els}=setup();
  assert.equal(els.is36Count.textContent,'0 datas selecionadas');
  assert.equal(ctx.aiCalled,undefined);
  assert.equal(els.is36Dates.inputs.length,2);
});
test('exporta e salva apenas as datas assinaladas com HTML seguro',async()=>{
  const {ctx,els}=setup();
  els.is36Dates.inputs.find(x=>x.value==='2020-01-02').checked=true;
  els.is36Dates.events.change();
  els.is36Summary.value='Texto revisado pela fisioterapeuta';
  els.is36Print.events.click();
  assert.match(ctx.printed,/02\/01\/2020/);
  assert.doesNotMatch(ctx.printed,/03\/01\/2020/);
  assert.doesNotMatch(ctx.printed,/<script>|<indevida>/);
  await els.is36Save.events.click();
  assert.equal(ctx.persistCalled,true);
  assert.equal(ctx.patients[0].relatorios.length,1);
  const doc=ctx.patients[0].relatorios[0];
  assert.equal(doc.reportDates.length,1);
  assert.equal(doc.reportDates[0],'2020-01-02');
  assert.doesNotMatch(doc.text,/Conduta <indevida>/);
  assert.match(doc.text,/Texto revisado/);
});
test('impede salvar relatório sem ao menos uma data',async()=>{
  const {ctx,els}=setup();
  await els.is36Save.events.click();
  assert.equal(ctx.patients[0].relatorios.length,0);
  assert.match(ctx.alertText,/Selecione pelo menos uma data/);
});
