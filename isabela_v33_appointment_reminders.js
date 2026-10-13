/* Isabela Martins v33 — lembretes locais de atendimento */
(function(){
  'use strict';

  const CHANNEL_ID='appointment_reminders';
  const REMINDER_MINUTES=10;
  const NOTIFICATION_ID_BASE=120000;
  const MAX_SCHEDULED=350;
  let syncing=false;
  let initialized=false;

  function plugin(){
    return globalThis.Capacitor?.Plugins?.LocalNotifications||null;
  }

  function appointmentDate(a){
    if(!a?.date||!a?.start)return null;
    const d=new Date(`${a.date}T${a.start}:00`);
    return Number.isNaN(d.getTime())?null:d;
  }

  function patientName(a){
    try{return patientById(a?.patientId)?.name||'Paciente';}catch(_){return 'Paciente';}
  }

  function isReminderId(id){
    return Number.isInteger(Number(id))&&Number(id)>=NOTIFICATION_ID_BASE&&Number(id)<NOTIFICATION_ID_BASE+MAX_SCHEDULED+100;
  }

  async function ensurePermissions(){
    const LocalNotifications=plugin();
    if(!LocalNotifications)return false;
    try{
      let p=await LocalNotifications.checkPermissions();
      if(p?.display!=='granted')p=await LocalNotifications.requestPermissions();
      return p?.display==='granted';
    }catch(err){
      console.warn('[v33 lembretes] Permissão de notificações indisponível.',err);
      return false;
    }
  }

  async function ensureChannel(){
    const LocalNotifications=plugin();
    if(!LocalNotifications)return;
    try{
      await LocalNotifications.createChannel({
        id:CHANNEL_ID,
        name:'Lembretes de atendimentos',
        description:'Avisos 10 minutos antes dos atendimentos agendados.',
        importance:4,
        visibility:1,
        vibration:true,
        lights:true,
        lightColor:'#D6BD78',
        sound:'isabela_reminder.wav'
      });
    }catch(err){
      console.warn('[v33 lembretes] Canal não pôde ser criado.',err);
    }
  }

  async function cancelAppointmentReminders(){
    const LocalNotifications=plugin();
    if(!LocalNotifications)return;
    try{
      const pending=await LocalNotifications.getPending();
      const mine=(pending?.notifications||[]).filter(n=>
        n?.extra?.source==='isabela-appointment'||
        n?.extra?.kind==='appointment-reminder'||
        isReminderId(Number(n?.id))
      );
      if(mine.length)await LocalNotifications.cancel({notifications:mine.map(n=>({id:Number(n.id)}))});
    }catch(err){
      console.warn('[v33 lembretes] Não foi possível limpar lembretes antigos.',err);
    }
  }

  async function syncAppointmentReminders(){
    if(syncing)return;
    const LocalNotifications=plugin();
    if(!LocalNotifications)return;
    syncing=true;
    try{
      if(!await ensurePermissions())return;
      await ensureChannel();
      await cancelAppointmentReminders();

      const now=Date.now();
      const list=(typeof appointments!=='undefined'&&Array.isArray(appointments)?appointments:[])
        .filter(a=>a&&a.status==='Agendado')
        .map(a=>({a,start:appointmentDate(a)}))
        .filter(x=>x.start&&x.start.getTime()-REMINDER_MINUTES*60000>now)
        .sort((x,y)=>x.start-y.start)
        .slice(0,MAX_SCHEDULED);

      if(!list.length)return;

      const notifications=list.map((x,i)=>{
        const a=x.a;
        const at=new Date(x.start.getTime()-REMINDER_MINUTES*60000);
        const name=patientName(a);
        const address=(a.address||'').trim();
        return {
          id:NOTIFICATION_ID_BASE+i,
          title:'Atendimento em 10 minutos',
          body:`${name} • ${a.start}${address?` • ${address}`:''}`,
          largeBody:`Atendimento de ${name} às ${a.start}.${address?` Local: ${address}.`:''}`,
          channelId:CHANNEL_ID,
          group:'appointments',
          autoCancel:true,
          schedule:{at,allowWhileIdle:true,isExactNotification:true,isExactMandatory:false},
          extra:{source:'isabela-appointment',kind:'appointment-reminder',appointmentId:a.id}
        };
      });

      const result=await LocalNotifications.schedule({notifications});
      if(result?.warning)console.warn('[v33 lembretes]',result.warning);
      console.info(`[v33 lembretes] ${notifications.length} lembrete(s) agendado(s).`);
    }catch(err){
      console.error('[v33 lembretes] Falha ao sincronizar notificações.',err);
    }finally{
      syncing=false;
    }
  }

  function wrapAsync(name){
    const original=globalThis[name];
    if(typeof original!=='function'||original.__v33ReminderWrapped)return;
    const wrapped=async function(...args){
      const result=await original.apply(this,args);
      setTimeout(syncAppointmentReminders,150);
      return result;
    };
    wrapped.__v33ReminderWrapped=true;
    globalThis[name]=wrapped;
  }

  function wrapMutationFunctions(){
    ['saveAppointment','saveRecurrenceEdit','deleteAppointment','setAppointmentStatus','pauseRecurrence','resumeRecurrence','cancelRecurrence'].forEach(wrapAsync);
  }

  async function openAppointmentFromNotification(event){
    const appointmentId=event?.notification?.extra?.appointmentId;
    if(!appointmentId)return;
    try{
      currentPage='agenda';
      if(typeof render==='function')render();
      setTimeout(()=>{
        try{
          if(appointments?.some?.(a=>a.id===appointmentId)&&typeof openAppointmentModal==='function')openAppointmentModal(appointmentId);
        }catch(_){ }
      },350);
    }catch(_){ }
  }

  async function initAppointmentReminders(){
    if(initialized)return;
    const LocalNotifications=plugin();
    if(!LocalNotifications){setTimeout(initAppointmentReminders,800);return;}
    initialized=true;
    wrapMutationFunctions();
    try{await LocalNotifications.addListener('localNotificationActionPerformed',openAppointmentFromNotification);}catch(_){ }
    await syncAppointmentReminders();
    setTimeout(syncAppointmentReminders,5000);
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(syncAppointmentReminders,700);
  });
  window.addEventListener('focus',()=>setTimeout(syncAppointmentReminders,900));

  globalThis.syncAppointmentReminders=syncAppointmentReminders;
  globalThis.initAppointmentReminders=initAppointmentReminders;
  setTimeout(initAppointmentReminders,1200);
})();
