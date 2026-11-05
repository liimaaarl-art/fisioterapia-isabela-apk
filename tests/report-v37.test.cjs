const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('isabela_v37_report_presentation.js', 'utf8');

function init() {
  const nodes = {};
  function node(tag, id) {
    return {
      tagName: tag, id, className: '', textContent: '', children: [],
      classList: {add(){}, remove(){}, toggle(){}},
      parentNode: {insertBefore(){}},
      addEventListener(){}, appendChild(child){this.children.push(child);},
      get innerHTML(){return this.children.map(x => x.textContent).join('');}
    };
  }
  ['aiModal','aiModalText','aiModalSaveBtn'].forEach(id => nodes[id] = node('div',id));
  const received = [];
  const ctx = {
    document: {
      getElementById(id){return nodes[id];},
      createElement(tag){return node(tag);},
      head: {appendChild(){}}
    },
    window: {openAITextModal(...args){received.push(args);}},
    module: {exports:{}}
  };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  return {ctx, nodes, received};
}

test('limpa tabelas e <br> sem perder a data ou os valores clinicos', () => {
  const {ctx} = init();
  const raw = '| Data | Sinais vitais |\n|------|-----|\n| **05/10/2026** | PA 120 x 80 mmHg <br> SpO2 96% |';
  const text = ctx.module.exports.normalize(raw);
  assert.match(text, /ATENDIMENTO — 05\/10\/2026/);
  assert.match(text, /PA 120 x 80 mmHg/);
  assert.match(text, /SpO2 96%/);
  assert.doesNotMatch(text, /<br|\|/i);
});

test('mostra cada data num bloco e envia texto limpo ao salvamento existente', () => {
  const {ctx, nodes, received} = init();
  ctx.window.openAITextModal('Relatório sintético', '| **05/10/2026** | Conduta 1', {saveReport:true, patientId:'fake'});
  assert.equal(received.length, 1);
  assert.match(received[0][1], /ATENDIMENTO — 05\/10\/2026/);
  const day = nodes.aiModalText.children.find(el => el.className === 'is37-day');
  assert.ok(day, 'Bloco por data deve existir');
  assert.match(day.children[0].textContent, /05\/10\/2026/);
});

test('não altera outras respostas da IA sem modo relatório', () => {
  const {ctx, received} = init();
  ctx.window.openAITextModal('Assistente', 'Um | dois <br> três');
  assert.equal(received[0][1], 'Um | dois <br> três');
});
