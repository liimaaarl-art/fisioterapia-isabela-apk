/* Isabela Martins v27 • Agenda informativa • Florindo Sistemas */
(function(){
'use strict';

function ensureAgendaV27Style(){
  if(document.getElementById('agendaV27Css'))return;
  const s=document.createElement('style');
  s.id='agendaV27Css';
  s.textContent=`
  .agenda-v27-flags{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;align-items:center}
  .agenda-v27-flag{display:inline-flex;align-items:center;gap:3px;padding:3px 6px;border-radius:999px;font-size:8px;font-weight:850;line-height:1.15;border:1px solid #dfe5da;background:#f4f6f1;color:#60705d;white-space:nowrap}
  .agenda-v27-flag.realizado,.agenda-v27-flag.pago,.agenda-v27-flag.evolucao-salva{background:#e9f1e7;color:#3f6b44;border-color:#d0decf}
  .agenda-v27-flag.agendado,.agenda-v27-flag.nao-pago,.agenda-v27-flag.sem-evolucao{background:#f7f0e3;color:#8e6d38;border-color:#eadcc3}
  .agenda-v27-flag.nao-realizado,.agenda-v27-flag.cancelado{background:#faeded;color:#a14949;border-color:#ecd2d2}
  .agenda-v27-month-event{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;padding:5px 6px!important;margin-bottom:5px!important}
  .agenda-v27-month-event .agenda-v27-title{display:flex;gap:4px;align-items:flex-start;line-height:1.25;min-width:0}
  .agenda-v27-month-event .agenda-v27-title span{font-weight:850;flex:0 0 auto}
  .agenda-v27-month-event .agenda-v27-title strong{font-size:8.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .agenda-v27-month-event .agenda-v27-flags{gap:3px;margin-top:4px}
  .agenda-v27-month-event .agenda-v27-flag{font-size:7px;padding:2px 4px}
  .agenda-v27-daycell{min-height:132px!important}
  .agenda-card .agenda-v27-flags{margin-top:7px}
  .day-event .agenda-v27-flags{margin-top:7px}
  @media(max-width:760px){
    .agenda-v27-month-event .agenda-v27-flag{font-size:6.6px;padding:2px 3px}
    .agenda-v27-daycell{min-height:128px!important}
  }
  `;
  document.head.appendChild(s);
}

function v27Flag(text,icon){
  const value=String(text||'');
  return `<span class="agenda-v27-flag ${normalize(value)}">${icon||''}${esc(value)}</span>`;
}
function v27QuickFlags(a,compact=false){
  const status=a?.status||'Agendado';
  const pay=paymentStatus(a);
  const evo=evolutionStatus(a);
  if(compact){
    return `<div class="agenda-v27-flags">${v27Flag(status,status==='Realizado'?'✓ ':status==='Cancelado'||status==='Não realizado'?'! ':'• ')}${v27Flag(pay,pay==='Pago'?'$ ':'○ ')}${v27Flag(evo,evo==='Evolução salva'?'✓ ':'○ ')}</div>`;
  }
  return `<div class="agenda-v27-flags">${statusBadge(status)}${paymentBadge(a)}${evolutionBadge(a)}</div>`;
}

const previousRenderAgenda=typeof renderAgenda==='function'?renderAgenda:null;
if(previousRenderAgenda){
  renderAgenda=function(){
    ensureAgendaV27Style();
    let range=agendaRange(),arr=filteredApps(),actions=`<button class="btn primary" onclick="openAppointmentModal()">+ Novo atendimento</button>`;
    let body='';
    if(agendaView==='month'){
      let month=agendaDate.getMonth();
      body=`<div class="calendar-scroll"><div class="month-grid">${DAYS.map(d=>`<div class="dow">${d}</div>`).join('')}${range.map(ds=>{
        let d=parseDate(ds),ev=arr.filter(a=>a.date===ds).sort((a,b)=>(a.start||'').localeCompare(b.start||''));
        return `<div class="daycell agenda-v27-daycell ${d.getMonth()!==month?'out':''} ${ds===today()?'today':''}" ondblclick="openAppointmentModal('', '${ds}')"><div class="daynum">${d.getDate()}</div>${ev.slice(0,4).map(a=>`<div class="cal-event agenda-v27-month-event ${normalize(a.status)}" onclick="event.stopPropagation();openAppointmentModal('${a.id}')"><div class="agenda-v27-title"><span>${esc(a.start||'--:--')}</span><strong>${esc(appointmentName(a))}</strong></div>${v27QuickFlags(a,true)}</div>`).join('')}${ev.length>4?`<div class="subtle">+${ev.length-4} outros</div>`:''}</div>`;
      }).join('')}</div></div>`;
    }else if(agendaView==='week'){
      body=`<div class="week-grid">${range.map(ds=>{
        let ev=arr.filter(a=>a.date===ds).sort((a,b)=>(a.start||'').localeCompare(b.start||'')),d=parseDate(ds);
        return `<div class="week-day"><h4>${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}${ds===today()?' • Hoje':''}</h4>${ev.map(a=>`<div class="agenda-card ${normalize(a.status)}" onclick="openAppointmentModal('${a.id}')"><b>${esc(a.start||'--:--')} • ${esc(appointmentName(a))}</b><small>${esc(a.end||'')} • ${brMoney(a.value)}</small>${v27QuickFlags(a,false)}</div>`).join('')||'<div class="subtle">Sem atendimentos</div>'}<button class="btn tiny" style="margin-top:8px" onclick="openAppointmentModal('', '${ds}')">+ horário</button></div>`;
      }).join('')}</div>`;
    }else{
      let ds=range[0],ev=arr.filter(a=>a.date===ds).sort((a,b)=>(a.start||'').localeCompare(b.start||''));
      body=`<div class="day-list">${ev.map(a=>`<div class="day-event"><div class="time">${esc(a.start||'--:--')}</div><div><b>${esc(appointmentName(a))}</b><div class="subtle">${esc(a.end||'')} • ${brMoney(a.value)} • ${esc(a.address||'')}</div>${v27QuickFlags(a,false)}</div><div class="head-actions"><button class="btn tiny evolution" onclick="openDailyEvolutionModal('${a.id}')">${evolutionForAppointment(a)?'Editar evolução':'Adicionar evolução'}</button><button class="btn tiny" onclick="setAppointmentStatus('${a.id}','Realizado')">✓ Realizado</button><button class="btn tiny" onclick="openAppointmentModal('${a.id}')">Editar</button></div></div>`).join('')||'<div class="empty">Nenhum atendimento neste dia.</div>'}</div>`;
    }
    document.getElementById('main').innerHTML=pageHead('Agenda Operacional','Status, pagamento e evolução visíveis antes de abrir cada atendimento.',actions)+`<div class="calendar-top"><div class="segmented">${['day','week','month'].map(v=>`<button class="${agendaView===v?'active':''}" onclick="agendaView='${v}';render()">${v==='day'?'Dia':v==='week'?'Semana':'Mês'}</button>`).join('')}</div><div class="head-actions"><button class="btn" onclick="moveAgenda(-1)">←</button><button class="btn" onclick="agendaDate=new Date();render()">Hoje</button><button class="btn" onclick="moveAgenda(1)">→</button><b style="align-self:center;font-size:12px;min-width:150px;text-align:center">${esc(agendaLabel())}</b></div><div class="filter-row">${agendaFilters()}</div></div>${body}`;
  };
  window.renderAgenda=renderAgenda;
}

ensureAgendaV27Style();
})();
