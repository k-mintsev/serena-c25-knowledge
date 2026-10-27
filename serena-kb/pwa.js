/* Local files work directly; HTTPS/localhost adds an offline cache. */
(()=>{
  const status=document.getElementById('connection-status'),install=document.getElementById('install-app'),refresh=document.getElementById('refresh-app');
  if(location.protocol==='file:'){status.textContent='Локальные файлы';return;}
  let prompt;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});
  install.addEventListener('click',async()=>{if(prompt){await prompt.prompt();prompt=null;install.hidden=true;}});
  let registration,reloading=false,hadController=!!navigator.serviceWorker?.controller;
  refresh.hidden=false;
  refresh.addEventListener('click',async()=>{
    if(!navigator.onLine){status.textContent='Для обновления нужен интернет';return;}
    refresh.disabled=true;status.textContent='Проверка обновлений';
    try{
      await registration?.update();
      if(registration?.installing){status.textContent='Загрузка новой версии';return;}
      location.reload();
    }catch{status.textContent='Не удалось обновить · попробуйте ещё раз';refresh.disabled=false;}
  });
  if(!('serviceWorker' in navigator)){status.textContent='Сетевая версия';return;}
  const activated=()=>{status.textContent=navigator.onLine?'Готово к работе офлайн':'Офлайн · сохранённая база';};
  status.textContent='Подготовка офлайн-копии';
  // Reload a previously controlled page only after the complete new cache is ready.
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(hadController&&!reloading){reloading=true;location.reload();return;}
    hadController=true;activated();
  });
  navigator.serviceWorker.register(new URL('../serena-kb-sw.js',SerenaData.root),{updateViaCache:'none'}).then(reg=>{
    registration=reg;
    if(reg.active)activated();
    const observe=worker=>worker?.addEventListener('statechange',()=>{
      if(worker.state==='activated'){refresh.disabled=false;activated();}
      if(worker.state==='redundant'){refresh.disabled=false;status.textContent='Обновление не загружено · попробуйте ещё раз';}
    });
    observe(reg.installing);reg.addEventListener('updatefound',()=>observe(reg.installing));
  }).catch(()=>{status.textContent='Сетевая версия';});
  window.addEventListener('offline',()=>{status.textContent=navigator.serviceWorker.controller?'Офлайн · сохранённая база':'Нет подключения';});
  const check=()=>registration?.update().catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine)check();});
  window.addEventListener('online',()=>{if(navigator.serviceWorker.controller)activated();check();});
})();
