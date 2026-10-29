/* Canonical operations and image paths belong to data/serena-vehicle-kb.json. */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let phase='removal',guideChoice=null,current=null,activeGuide=null,activeOperations=[];
  const stepChoice=new Map();
  const procedure=db=>(db.service.procedures||[]).find(p=>p.id===new URLSearchParams(location.hash.slice(1)).get('procedure'));
  function stepText(value) {
    const text=String(value),pattern=/\[([^\]]+)\]\((part|procedure|fastener):([A-Za-z0-9-]+)\)/g;
    let result='',offset=0;
    for(const match of text.matchAll(pattern)) {
      result+=esc(text.slice(offset,match.index));
      if(match[2]==='fastener')result+=`<button class="service-reference" data-fastener="${esc(match[3])}">${esc(match[1])}</button>`;
      else if(match[2]==='part')result+=partLink(match[3],match[1]);
      else result+=`<a href="#part=${esc(current.part.id)}&amp;procedure=${esc(match[3])}">${esc(match[1])}</a>`;
      offset=match.index+match[0].length;
    }
    return result+esc(text.slice(offset));
  }
  function partLink(id,label) {
    const part=current.db.components.find(p=>p.id===id);
    const page=current.db.systems.find(s=>s.status==='partial'&&s.contextParts?.includes(id))?.id||part.system;
    return `<a href="${esc(SerenaData.routes[page]+'#part='+id)}">${esc(label||part.name)} ↗</a>`;
  }
  function renderPhotoSteps(guide,operations,photo,media) {
    activeGuide=guide;activeOperations=operations;
    const hasOverview=phase==='removal'&&guide.overview?.imageId;
    const index=Math.max(hasOverview?-1:0,Math.min(stepChoice.get(guide.id+phase)??(hasOverview?-1:0),operations.length-1));
    const title=op=>op[phase+'Title']||op.title;
    const prerequisites=guide.prerequisites||[];
    const overview=guide.overview;
    const legend=()=>`<ul class="service-role-legend" aria-label="Цвета схемы">${[['context','Окружение'],['related','Связанные детали'],['active','Текущий объект'],['fastener','Крепёж']].map(([role,label])=>`<li><span class="service-role-${role}" aria-hidden="true"></span>${label}</li>`).join('')}</ul>`;
    return `<section class="panel reader-section service-panel" id="service" data-guide="${esc(guide.id)}" data-ready="${guide.readyForWork}" data-phase="${phase}">
      <h2>${esc(guide.sectionTitle||'Снятие и установка')}</h2>${guide.returnHref?`<p><a href="${esc(guide.returnHref)}">← Вернуться к узлу: ${esc(current.part.name)}</a></p>`:''}<p class="reader-service-caption">${esc(guide.photoCaption||guide.title)}</p>
      <div class="service-phases" role="group" aria-label="Этап работ"><button data-service-phase="removal" aria-pressed="${phase==='removal'}">Снятие</button><button data-service-phase="installation" aria-pressed="${phase==='installation'}">Установка</button></div>
      <nav class="service-photo-route" aria-label="Шаги инструкции">${hasOverview?`<button data-service-index="-1" aria-current="${index===-1?'step':'false'}">На автомобиле</button>`:''}${operations.map((op,i)=>`<button data-service-index="${i}" aria-current="${index===i?'step':'false'}"><span>${i+1}</span>${esc(title(op))}</button>`).join('')}</nav>
      ${hasOverview?`<article class="reader-service-overview" data-service-overview ${index===-1?'':'hidden'}><p class="service-step-count">Расположение до подготовки доступа</p><h3>${esc(overview.title)}</h3>${collisionNotice(overview.imageId,media)}${photo(media.service[overview.imageId],overview.title,overview.caption)}${legend()}${(overview.description||[]).map(text=>`<p>${stepText(text)}</p>`).join('')}</article>`:''}
      ${phase==='removal'&&guide.preparation?.length?`<div class="service-preparation"><h3>Подготовить доступ</h3><ol>${guide.preparation.map(t=>`<li>${stepText(t)}</li>`).join('')}</ol></div>`:''}
      ${phase==='removal'&&prerequisites.length?`<div class="service-prerequisites"><h3>Перед началом</h3><ul>${prerequisites.map(p=>`<li>${p.partId?partLink(p.partId,p.title):esc(p.title)}${p.detail?`<span>${esc(p.detail)}</span>`:''}</li>`).join('')}</ul></div>`:''}
      ${operations.map((op,i)=>{
        const imageId=op[phase+'ImageId']||op.imageId;
        return `<article class="reader-service-card" tabindex="-1" id="service-op-${op.id}" data-operation="${op.id}" ${index===i?'':'hidden'}><p class="service-step-count">Шаг ${i+1} из ${operations.length}</p><h3>${esc(title(op))}</h3>${collisionNotice(imageId,media)}${imageId?photo(media.service[imageId],title(op),op[phase+'Caption']||op.imageCaption||'Иллюстрация по материалу источника.'):''}${imageId&&op.presentationRoles?legend():''}<ol>${(op[phase+'Display']||op[phase]).map(t=>`<li>${stepText(t)}</li>`).join('')}</ol>${hardwareLinks(op)}${phase==='installation'&&op.returnParts?.length?`<p class="service-return">Вернуть на место: ${op.returnParts.map(id=>partLink(id)).join(' · ')}</p>`:''}</article>`;
      }).join('')}
      ${phase==='installation'&&index===operations.length-1&&guide.completion?.length?`<div class="service-completion"><h3>Завершение</h3><ol>${guide.completion.map(t=>`<li>${stepText(t)}</li>`).join('')}</ol></div>`:''}
      <div class="service-step-controls"><button data-service-index="${index-1}" ${index===(hasOverview?-1:0)?'disabled':''}>← Назад</button><span>${index===-1?'Обзор':`${index+1} / ${operations.length}`}</span><button class="primary" data-service-index="${index+1}" ${index===operations.length-1?'disabled':''}>Далее →</button></div>
    </section>`;
  }
  function hardwareLinks(op) {
    const library=current.db.service.fastenerLibrary;
    if(!library)return '';
    const ids=op.fastenerAssetIds||[];
    return `<div class="service-hardware">${ids.map(id=>{const entry=library.entries.find(e=>e.id===id);return `<button class="${entry.kind==='tool'?'tool-link':'fastener-link'}" data-fastener="${esc(id)}">${esc(id+' · '+entry.title)} ↗</button>`;}).join('')}<button data-fastener="wall">Стенд крепежей и инструментов ↗</button></div>`;
  }
  function collisionNotice(imageId,media) {
    const check=media.supplemental?.[imageId]?.collisionValidation;
    if(!check||check.status==='CLEAR')return '';
    return `<aside class="collision-warning" role="alert"><strong>${check.errorCount?'В модели обнаружены пересечения':'Проверка геометрии не завершена'}</strong><p>Красным выделена проблемная зона${check.focusLabels?.length?': '+check.focusLabels.map(esc).join(' / '):''}.</p><p>Этот кадр показывает ошибку модели; геометрию нужно исправить.</p><details><summary>Результат проверки</summary><p>Подтверждено пересечений: ${esc(check.errorCount)}; требуют уточнения: ${esc(check.warningCount)}.</p></details></aside>`;
  }
  function openHardware(id) {
    const library=current.db.service.fastenerLibrary;
    if(!library)return;
    document.getElementById('fastener-detail')?.remove();
    const entry=library.entries.find(e=>e.id===id),dialog=document.createElement('dialog');dialog.id='fastener-detail';
    const factory=entry?.factory;
    const tooling=entry?.tooling;
    const toolLinks=tooling?`<p>Инструмент: ${tooling.toolAssetIds.map(tid=>`<button data-fastener="${esc(tid)}">${esc(tid+' · '+library.entries.find(e=>e.id===tid).title)}</button>`).join(' + ')}.</p><p>Размер головки: ${esc(tooling.socketSizeMm==null?'не подтверждён':tooling.socketSizeMm+' мм')}.</p>`:'';
    const fields=entry?.kind==='tool'?[['Роль','Инструмент / оснастка'],['Размер / привод',null],['Выбранная модель',null]]:factory?[['Обозначение резьбы',factory.designation],['Диаметр, мм',factory.diameterMm],['Шаг, мм',factory.pitchMm],['Длина, мм',factory.lengthMm],['Класс прочности',factory.strengthClass],['Номер детали',factory.partNumber],['Затяжка, Н·м',factory.torqueNm]]:[];
    dialog.setAttribute('aria-labelledby','fastener-heading');
    dialog.innerHTML=`<div class="fastener-toolbar"><button data-close-fastener>Закрыть</button><label>Деталь <select id="fastener-select"><option value="wall">Общий стенд</option>${library.entries.map(e=>`<option value="${esc(e.id)}" ${id===e.id?'selected':''}>${esc(e.id+' · '+e.title)}</option>`).join('')}</select></label></div><h2 id="fastener-heading">${esc(entry?entry.id+' · '+entry.title:'Крепежи и инструменты — стенд')}</h2>${current.photo(current.media.service[entry?.imageId||library.wallImageId],entry?.title||'Стенд крепежей',entry?.status||'На стенде показаны общие модели; масштабы карточек различаются.')}${entry?`<p>${esc(entry.description)}</p>${toolLinks}<dl class="fastener-fields">${fields.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value??'Не подтверждено')}</dd></div>`).join('')}</dl>`:''}`;
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  }
  function order(guide,operations,mode=phase) {
    const byId=new Map(operations.map(op=>[op.id,op])),result=[],visited=new Set(),active=new Set();
    function visit(id) {
      if(visited.has(id))return;
      if(active.has(id)||!byId.has(id))throw new Error('Invalid service dependency: '+id);
      active.add(id);const op=byId.get(id);op.dependsOn.forEach(visit);active.delete(id);visited.add(id);result.push(op);
    }
    visit(guide.targetOperation);
    return mode==='installation'?guide.installationOrder.map(id=>byId.get(id)):result;
  }
  function operationsFor(part,db) {
    const selected=procedure(db);if(selected)return (phase==='installation'&&selected.installationOrder||selected.operationIds).map(id=>db.service.operations.find(op=>op.id===id));
    const ids=new Set();
    return db.service.guides.filter(g=>part.serviceGuideIds.includes(g.id)).flatMap(g=>order(g,db.service.operations,'removal')).filter(op=>{if(ids.has(op.id))return false;ids.add(op.id);return true;});
  }
  function render(part,db,media,photo,sourceLink) {
    current={part,db,media,photo,sourceLink};
    const selected=procedure(db);
    if(selected)return renderPhotoSteps({...selected,sectionTitle:selected.title,returnHref:'#part='+part.id,readyForWork:false},(phase==='installation'&&selected.installationOrder||selected.operationIds).map(id=>db.service.operations.find(op=>op.id===id)),photo,media);
    const guides=(db.service?.guides||[]).filter(g=>part.serviceGuideIds?.includes(g.id));
    if(!guides.length){
      const group=db.assemblies.find(a=>a.id===part.assemblyId);
      const related=[group.root,...group.children].filter(id=>id!==part.id&&db.components.find(p=>p.id===id)?.serviceGuideIds.length);
      return `<section class="panel reader-section" id="service"><h2>Снятие и установка</h2>${related.length?`<p>Операции узла в сборе:</p><div class="reader-service-links">${related.map(id=>partLink(id)).join('')}</div>`:'<p class="reader-empty"><a href="#sources">Открыть инструкции и материалы по узлу ↓</a></p>'}</section>`;
    }
    const guide=guides.find(g=>g.id===guideChoice)||guides[0];guideChoice=guide.id;
    return renderPhotoSteps(guide,order(guide,db.service.operations),photo,media);
  }

  function refresh() {
    const section=document.getElementById('service');if(section&&current)section.outerHTML=render(current.part,current.db,current.media,current.photo,current.sourceLink);
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-close-fastener]')){document.getElementById('fastener-detail')?.close();return;}
    const hardware=event.target.closest('[data-fastener]');
    if(hardware){openHardware(hardware.dataset.fastener);return;}
    const step=event.target.closest('[data-service-index]');
    if(step&&current&&activeGuide){const index=Number(step.dataset.serviceIndex);if(index>=(phase==='removal'&&activeGuide.overview?-1:0)&&index<activeOperations.length){stepChoice.set(activeGuide.id+phase,index);refresh();}return;}
    const phaseButton=event.target.closest('[data-service-phase]');
    if(phaseButton){phase=phaseButton.dataset.servicePhase;refresh();return;}
    const jump=event.target.closest('[data-service-jump]');
    if(jump)document.getElementById('service-op-'+jump.dataset.serviceJump)?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.addEventListener('change',event=>{if(event.target.id==='fastener-select')openHardware(event.target.value);if(event.target.id==='service-guide'){guideChoice=event.target.value;refresh();}});
  globalThis.SerenaService={render,operationsFor};
})();
