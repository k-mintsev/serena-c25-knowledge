/* Canonical operations and image paths belong to docs/serena-vehicle-kb.json. */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let phase='removal',guideChoice=null,current=null;
  const stepChoice=new Map();
  function partLink(id,label) {
    const part=current.db.components.find(p=>p.id===id);
    const page=current.db.systems.find(s=>s.status==='partial'&&s.contextParts?.includes(id))?.id||part.system;
    return `<a href="${esc(SerenaData.routes[page]+'#part='+id)}">${esc(label||part.name)} ↗</a>`;
  }
  function renderPhotoSteps(guide,operations,photo,media) {
    const index=Math.min(stepChoice.get(guide.id+phase)||0,operations.length-1);
    const title=op=>op[phase+'Title']||op.title;
    const prerequisites=guide.prerequisites||[];
    return `<section class="panel reader-section service-panel" id="service" data-guide="${esc(guide.id)}" data-ready="${guide.readyForWork}" data-phase="${phase}">
      <h2>Снятие и установка</h2><p class="reader-service-caption">${esc(guide.photoCaption||guide.title)}</p>
      ${phase==='removal'&&prerequisites.length?`<div class="service-prerequisites"><h3>Перед началом</h3><ul>${prerequisites.map(p=>`<li>${p.partId?partLink(p.partId,p.title):esc(p.title)}${p.detail?`<span>${esc(p.detail)}</span>`:''}</li>`).join('')}</ul></div>`:''}
      <div class="service-phases" role="group" aria-label="Этап работ"><button data-service-phase="removal" aria-pressed="${phase==='removal'}">Снятие</button><button data-service-phase="installation" aria-pressed="${phase==='installation'}">Установка</button></div>
      <nav class="service-photo-route" aria-label="Шаги инструкции">${operations.map((op,i)=>`<button data-service-index="${i}" aria-current="${index===i?'step':'false'}"><span>${i+1}</span>${esc(title(op))}</button>`).join('')}</nav>
      ${operations.map((op,i)=>{
        const imageId=op[phase+'ImageId']||op.imageId;
        return `<article class="reader-service-card" tabindex="-1" id="service-op-${op.id}" data-operation="${op.id}" ${index===i?'':'hidden'}><p class="service-step-count">Шаг ${i+1} из ${operations.length}</p><h3>${esc(title(op))}</h3>${imageId?photo(media.service[imageId],title(op),op[phase+'Caption']||op.imageCaption||'Иллюстрация по материалу источника.'):''}<ol>${(op[phase+'Display']||op[phase]).map(t=>`<li>${esc(t)}</li>`).join('')}</ol>${phase==='installation'&&op.returnParts?.length?`<p class="service-return">Вернуть на место: ${op.returnParts.map(id=>partLink(id)).join(' · ')}</p>`:''}</article>`;
      }).join('')}
      <div class="service-step-controls"><button data-service-index="${index-1}" ${index===0?'disabled':''}>← Назад</button><span>${index+1} / ${operations.length}</span><button class="primary" data-service-index="${index+1}" ${index===operations.length-1?'disabled':''}>Далее →</button></div>
    </section>`;
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
    const ids=new Set();
    return db.service.guides.filter(g=>part.serviceGuideIds.includes(g.id)).flatMap(g=>order(g,db.service.operations,'removal')).filter(op=>{if(ids.has(op.id))return false;ids.add(op.id);return true;});
  }
  function render(part,db,media,photo,sourceLink) {
    current={part,db,media,photo,sourceLink};
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
    const step=event.target.closest('[data-service-index]');
    if(step&&current){const index=Number(step.dataset.serviceIndex),guide=current.db.service.guides.find(g=>g.id===guideChoice);if(guide&&index>=0&&index<order(guide,current.db.service.operations).length){stepChoice.set(guide.id+phase,index);refresh();}return;}
    const phaseButton=event.target.closest('[data-service-phase]');
    if(phaseButton){phase=phaseButton.dataset.servicePhase;refresh();return;}
    const jump=event.target.closest('[data-service-jump]');
    if(jump)document.getElementById('service-op-'+jump.dataset.serviceJump)?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.addEventListener('change',event=>{if(event.target.id==='service-guide'){guideChoice=event.target.value;refresh();}});
  globalThis.SerenaService={render,operationsFor};
})();
