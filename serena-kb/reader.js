/* The shared owner-approved reading layout; facts and editorial copy live in canonical data. */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const vehicleName=db=>[db.vehicle.make,db.vehicle.model,db.vehicle.frame?.split('-')[0]].filter(Boolean).join(' ');
  let current=null,choice=0;

  function model(html,part=null) {
    // Reuse the existing controls and scene; only their presentation changes.
    const template=document.createElement('template');template.innerHTML=html;
    const panel=template.content.firstElementChild;
    panel.classList.add('reader-model');
    panel.querySelector('.eyebrow').remove();
    panel.querySelector('h2').textContent=part?.presentation?.modelTitle||'Как работает узел';
    panel.querySelector(':scope > .muted').remove();
    panel.querySelector('.stage-caption span:last-child').remove();
    panel.querySelector('#model-previews').remove();
    const suspension=panel.querySelector('#spring').closest('details');suspension.remove();
    suspension.querySelector('summary').textContent='Подвеска';suspension.querySelector('.modelnotes').remove();
    panel.querySelectorAll(':scope > details:not(.layer-panel),.mechanism,.metrics').forEach(node=>node.remove());
    const controls=panel.querySelector('.controls'),sliders=panel.querySelector('.slider-row');
    const motion=document.createElement('details');motion.className='reader-motion-settings';
    motion.innerHTML='<summary>Движение</summary>';
    motion.append(controls.querySelector('#scenario'),sliders,suspension);
    const options=document.createElement('div');options.className='reader-model-options';
    const layers=panel.querySelector('.layer-panel');layers.querySelector('summary').textContent='Что показать';
    layers.querySelector('[data-layer-toggle="future"]').closest('label').remove();
    const toolbar=panel.querySelector('.scene-toolbar');toolbar.querySelector('span').remove();
    const cameras=document.createElement('div');cameras.className='reader-view-controls';
    const header=panel.querySelector('.modelheader');header.append(cameras);
    cameras.append(toolbar,header.querySelector('.viewtabs'));
    options.append(motion,layers);panel.append(options);
    const drivetrain=part?.explanation?.drivetrain;
    if(drivetrain)motion.append(template.content.querySelector('.drivetrain-controls'));
    if(part?.explanation?.diagram){
      const scene=document.createElement('div');scene.className='reader-vehicle-scene';
      scene.append(panel.querySelector('.model-stage'),controls,options);panel.append(scene);
      const tabs=document.createElement('div');tabs.className='reader-scene-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Место установки или разрез');
      tabs.innerHTML='<button data-reader-scene="vehicle" aria-pressed="true">На автомобиле</button><button data-reader-scene="section" aria-pressed="false">Уплотнение в разрезе</button>';
      header.after(tabs);
      const cutaway=document.createElement('div');cutaway.className='reader-cutaway';cutaway.hidden=true;cutaway.innerHTML='<div id="seal-cutaway"></div>';panel.append(cutaway);
    }
    if(drivetrain){
      const scene=document.createElement('div');scene.className='reader-vehicle-scene';scene.append(panel.querySelector('.model-stage'));panel.append(scene);
      const tabs=document.createElement('div');tabs.className='reader-scene-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Расположение или принцип действия');
      tabs.innerHTML='<button data-reader-scene="vehicle" aria-pressed="true">На автомобиле</button><button data-reader-scene="section" aria-pressed="false">Как работает CVT и привод</button>';header.after(tabs);
      const cutaway=document.createElement('div');cutaway.className='reader-cutaway';cutaway.hidden=true;cutaway.innerHTML='<div id="drivetrain-cutaway"></div>';scene.after(cutaway);
      panel.append(controls,options);
    }
    panel.querySelector('#reset').textContent='Сбросить';
    return panel.outerHTML;
  }

  function image(asset,title,caption) {
    const {media,photo}=current;
    const resource=media[asset.mediaGroup]?.[asset.mediaKey];
    return photo(typeof resource==='string'?resource:resource?.data,title,caption);
  }
  function galleryContent() {
    const entry=current.settings.appearance[choice];
    if(!entry)return '<p class="reader-empty"><a href="#motion">Посмотреть расположение на автомобиле ↑</a></p>';
    const asset=current.assets.find(a=>a.id===entry.visualId);
    const attribution=asset.sourceUrl?`<p class="reader-photo-source"><a href="${esc(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">Источник фотографии ↗</a></p>`:'';
    return image(asset,entry.title,entry.caption||asset.caption)+attribution;
  }
  const bullets=items=>`<ul>${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
  const material=(id,title,body)=>`<details class="reader-material" id="${id}"><summary>${esc(title)}</summary><div class="reader-material-body">${body}</div></details>`;
  function settingsFor(part,assets) {
    const labels={'source-photo':'Реальное фото','annotated-photo':'С пояснениями','product-photo':'Внешний вид','catalog-diagram':'Каталог','manufacturer-illustration':'Материал изготовителя'};
    const preference=['source-photo','product-photo','annotated-photo','manufacturer-illustration','catalog-diagram'];
    const candidates=assets.filter(a=>a.uses[part.id].some(role=>['overall','installed','removed'].includes(role)));
    const appearance=(candidates.length?candidates:assets.filter(a=>a.uses[part.id].includes('reference'))).sort((a,b)=>preference.indexOf(a.kind)-preference.indexOf(b.kind));
    const entries=appearance.map((a,i)=>({visualId:a.id,label:labels[a.kind]||'Изображение',title:a.title,caption:part.presentation?.imageCaptions?.[a.id]||a.caption||`${labels[a.kind]||'Иллюстрация'}${a.kind==='source-photo'?' · из внешнего материала':''}.`}));
    const totals=new Map();entries.forEach(e=>totals.set(e.label,(totals.get(e.label)||0)+1));
    const repeated=new Map();entries.forEach(e=>{const n=(repeated.get(e.label)||0)+1;repeated.set(e.label,n);if(totals.get(e.label)>1)e.label+=' '+n;});
    return {...part.presentation,appearance:part.presentation?.appearance||entries};
  }
  function mobilePicker(part,parts,db) {
    if(parts.length<=1)return '';
    const ids=new Set(parts.map(p=>p.id));
    return `<div class="mobile-picker"><button data-prev aria-label="Предыдущая деталь">‹</button><select id="part-picker" aria-label="Выберите деталь">${db.assemblies.map(a=>{const members=[a.root,...a.children].filter(id=>ids.has(id));return members.length?`<optgroup label="${esc(a.name)}">${members.map(id=>{const p=parts.find(p=>p.id===id);return `<option value="${id}" ${id===part.id?'selected':''}>${esc(p.name)}</option>`;}).join('')}</optgroup>`:'';}).join('')}</select><button data-next aria-label="Следующая деталь">›</button></div>`;
  }
  function ownerContent(part) {
    const {db,media,photo}=current,events=db.events.filter(e=>e.components.includes(part.id));
    const completed=events.filter(e=>e.type==='repair-completed');
    const ids=part.ownerPhotoGroup==='joint'?['1','2']:part.ownerPhotoGroup==='rings'?['3','4']:part.ownerPhotoGroup==='cv'?['5']:[];
    return `${bullets([part.currentOrder,...(completed.length?completed.map(e=>e.summary):['Записи о выполненном ремонте этого узла пока нет.'])])}${ids.length?`<details class="reader-owner-photos"><summary>Мои фотографии</summary><div class="owner-grid">${ids.map(id=>photo(media.owner[id],'Мой снимок №'+id,'Исходный снимок владельца; точный узел и сторону определяют при осмотре.')).join('')}</div></details>`:''}`;
  }
  function materialsContent(part,settings) {
    const {db,date}=current,explanation=part.explanation;
    const experiences=db.experiences.filter(e=>part.experienceIds.includes(e.id));
    const prices=db.prices.filter(p=>part.priceIds.includes(p.id)),purchase=prices.filter(p=>['part','consumable'].includes(p.kind)),labor=prices.filter(p=>!['part','consumable'].includes(p.kind));
    const related=settings.relatedCheck??part.relatedCheck;
    const relatedBody=typeof related==='string'?`<p>${esc(related)}</p>`:related?Object.entries(related).map(([title,value])=>title==='title'?`<p>${esc(value)}</p>`:`<h3>${esc(title)}</h3><p>${esc(value)}</p>`).join(''):'';
    return `${material('diagnostics','На что смотреть при осмотре',`<h3>Внешние признаки</h3>${bullets(part.diagnostics.visible)}<h3>Поведение машины</h3>${bullets(part.diagnostics.behavior)}<h3>Проверка в сервисе</h3>${bullets(settings.diagnosticChecks||part.diagnostics.checks)}`)}
      ${(explanation?.sections||[]).map((section,i)=>material('explanation-'+i,section.displayTitle||section.title,(section.displayParagraphs||section.paragraphs).map(t=>`<p>${esc(t)}</p>`).join(''))).join('')}
      ${relatedBody?material('repair-options','Что проверить и обсудить при ремонте',relatedBody):''}
      ${experiences.length?material('experience','Опыт владельцев и мастерских',experiences.map(e=>`<article class="reader-experience"><h3>${esc(e.title)}</h3><p>${esc(e.summary)}</p><p class="muted">${e.date?date(e.date)+' · ':''}${esc(e.model)}</p></article>`).join('')):''}
      ${explanation?.videoSourceIds?.length?material('videos','Видео изготовителя',`<ul>${explanation.videoSourceIds.map(id=>`<li>${current.sourceLink(id)}</li>`).join('')}</ul>`):''}
      ${prices.length?material('prices','Детали и работа: где купить и сколько стоит',`${purchase.length?`<h3>Покупка деталей</h3>${priceRows(purchase)}<p class="reader-price-note">Для заказа сверить сторону и артикул по номеру кузова ${esc(db.vehicle.frame)}.</p>`:''}${labor.length?`<h3>Работы в сервисе</h3>${priceRows(labor)}`:''}<p class="reader-price-note">Рядом с каждой суммой — продавец или сервис и дата цены.</p>`):''}`;
  }
  function sourcesContent(part) {
    const {db,media,photo,assets,sourceLink}=current;
    const guides=db.service.guides.filter(g=>part.serviceGuideIds.includes(g.id));
    const ops=SerenaService.operationsFor(part,db);
    const ids=new Set([...part.technicalSources,...guides.flatMap(g=>g.sourceIds),...ops.flatMap(o=>o.sourceIds),...assets.flatMap(a=>a.sourceIds||[]),...(part.explanation?.sections||[]).flatMap(s=>s.sourceIds||[])]);
    const experiences=db.experiences.filter(e=>part.experienceIds.includes(e.id));
    const originals=assets.filter(a=>['source-photo','product-photo'].includes(a.kind));
    const diagrams=assets.filter(a=>['catalog-diagram','manufacturer-illustration'].includes(a.kind));
    const shown=new Set(originals.map(a=>media[a.mediaGroup]?.[a.mediaKey]).map(r=>typeof r==='string'?r:r?.data));
    const extra=[...new Set(ops.flatMap(op=>op.originalImageIds))].filter(id=>!shown.has(media.service[id]));
    const events=db.events.filter(e=>e.components.includes(part.id)&&e.quote);
    return `${originals.length||extra.length?`<h3>Реальные фотографии</h3>${originals.map(a=>image(a,a.title,a.caption||'Оригинальное изображение из внешнего материала.')).join('')}${extra.map(id=>photo(media.service[id],'Исходная фотография','Оригинал материала по этому узлу.')).join('')}`:''}
      ${diagrams.length?`<h3>Схемы и каталоги</h3>${diagrams.map(a=>image(a,a.title,a.kind==='manufacturer-illustration'?'Материал изготовителя.':'Каталожный материал; подбор детали — по номеру кузова.')).join('')}`:''}
      <h3>Статьи и инструкции</h3><ul>${[...ids].filter(id=>id!=='quote').map(id=>`<li>${sourceLink(id)}</li>`).join('')}${assets.filter(a=>a.sourceUrl&&![...ids].some(id=>db.sources[id]?.url===a.sourceUrl)).map(a=>`<li><a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a></li>`).join('')}${experiences.filter(e=>![...ids].some(id=>db.sources[id]?.url===e.url)).map(e=>`<li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a></li>`).join('')}</ul>
      ${events.length?`<h3>Мои обращения</h3>${events.map(e=>`<blockquote>${esc(e.quote)}</blockquote>`).join('')}`:''}
      <h3>Документы моей машины</h3><p>${sourceLink('quote')}</p>`;
  }
  function priceRows(records) {
    const {db,media,fmt,date}=current;
    return `<div class="reader-offers">${records.map(p=>{
      const source=db.sources[p.sourceId],url=p.sourceId==='quote'?media.orderPdf:p.url||source?.url;
      const seller=p.sellerName||source?.provider||source?.title||(url?new URL(url).hostname:'Источник');
      return `<article class="reader-offer" data-price="${esc(p.id)}"><div><h4>${esc(p.itemLabel||p.scope)}</h4><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(seller)} ↗</a>${p.itemLabel?`<p>${esc(p.scope)}</p>`:''}</div><div class="reader-offer-amount"><strong>${p.from?'от ':''}${Array.isArray(p.amount)?p.amount.map(fmt).join('–'):fmt(p.amount)} ₽</strong><span>${p.quantity===1?'за 1 шт.':p.quantity===2?'за 2 шт.':''}</span><time datetime="${esc(p.observedDate)}">${date(p.observedDate)}</time></div></article>`;
    }).join('')}</div>`;
  }
  function render(part,db,media,helpers) {
    const assets=db.visuals.assets.filter(a=>a.status==='accepted'&&a.uses[part.id]);
    const settings=settingsFor(part,assets);
    current={part,db,media,...helpers,assets,settings};choice=0;
    const group=db.assemblies.find(a=>a.id===part.assemblyId);
    const related=[group.root,...group.children].filter(id=>id!==part.id);
    const page=helpers.pageSystem||db.systems.find(s=>s.id===part.system);
    const parts=helpers.pageParts||db.components.filter(p=>p.system===part.system);
    return `${mobilePicker(part,parts,db)}
      <div class="reader-heading" id="description"><p class="reader-breadcrumb">${esc(vehicleName(db))} <span>/</span> ${esc(page.name)}${page.contextTitle?' / '+esc(page.contextTitle):''}</p><h1>${esc(part.name)}</h1><nav class="jumpnav" aria-label="На этой странице"><a href="#purpose">Назначение</a><a href="#appearance">Внешний вид</a><a href="#service">Снятие</a><a href="#my-car">Моя машина</a><a href="#materials">Материалы</a></nav></div>
      ${helpers.model}
      <section class="panel reader-section" id="purpose"><h2>Для чего нужен и как работает</h2><p>${esc(settings.summary||part.description)}</p>${helpers.mechanics?`<p>${esc(helpers.mechanics)}</p>`:''}${settings.usage?`<p>${esc(settings.usage)}</p>`:''}<p class="reader-connections">${esc(part.connections)}</p><div class="reader-related">${related.map(id=>{const p=db.components.find(p=>p.id===id);return `<a href="${esc(helpers.partRoute(id))}">${esc(p.name)} ↗</a>`;}).join('')}</div></section>
      <section class="panel reader-section" id="appearance"><h2>Внешний вид</h2>${settings.appearance.length>1?`<div class="reader-gallery-tabs" role="tablist" aria-label="Изображения узла">${settings.appearance.map((entry,i)=>`<button role="tab" id="reader-tab-${i}" data-reader-image="${i}" aria-selected="${i===0}" aria-controls="reader-gallery-content" tabindex="${i===0?0:-1}">${esc(entry.label)}</button>`).join('')}</div>`:''}<div id="reader-gallery-content" ${settings.appearance.length>1?'role="tabpanel" aria-labelledby="reader-tab-0"':''}>${galleryContent()}</div></section>
      ${SerenaService.render(part,db,media,helpers.photo,helpers.sourceLink)}
      <section class="panel reader-section" id="my-car"><h2>Моя машина сейчас</h2>${ownerContent(part)}</section>
      <section class="panel reader-section" id="materials"><h2>Полезные материалы</h2>${materialsContent(part,settings)}</section>
      <details class="panel reader-sources" id="sources"><summary>Источники <span>Фотографии, схемы и статьи</span></summary><div class="reader-source-content">${sourcesContent(part)}</div></details><p class="reader-back"><a href="#description">К началу ↑</a></p>`;
  }

  function choose(index,focus=false) {
    if(!current||!current.settings.appearance[index])return;
    choice=index;
    const content=document.getElementById('reader-gallery-content');if(!content)return;
    content.innerHTML=galleryContent();content.setAttribute('aria-labelledby','reader-tab-'+index);
    document.querySelectorAll('[data-reader-image]').forEach(button=>{const active=Number(button.dataset.readerImage)===index;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    if(focus)document.getElementById('reader-tab-'+index).focus();
  }
  function showScene(mode) {
    const vehicle=document.querySelector('.reader-vehicle-scene'),cutaway=document.querySelector('.reader-cutaway');if(!vehicle||!cutaway)return;
    vehicle.hidden=mode!=='vehicle';cutaway.hidden=mode!=='section';document.querySelector('.reader-view-controls').hidden=mode!=='vehicle';
    document.querySelectorAll('[data-reader-scene]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.readerScene===mode)));
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-reader-image]');if(button)choose(Number(button.dataset.readerImage));const scene=event.target.closest('[data-reader-scene]');if(scene)showScene(scene.dataset.readerScene);});
  document.addEventListener('keydown',event=>{
    const button=event.target.closest('[data-reader-image]');if(!button||!current)return;
    const count=current.settings.appearance.length,i=Number(button.dataset.readerImage);
    const next=event.key==='ArrowRight'?(i+1)%count:event.key==='ArrowLeft'?(i+count-1)%count:event.key==='Home'?0:event.key==='End'?count-1:null;
    if(next!==null){event.preventDefault();choose(next,true);}
  });
  globalThis.SerenaReader={render,model,vehicleName};
})();
