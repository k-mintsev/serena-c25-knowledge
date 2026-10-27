/* Image purpose is independent of origin; one asset can serve several card sections. */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const selected=new Map();
  const labels={
    'source-photo':'Реальная фотография',
    'annotated-photo':'Разметка по реальным фото',
    'catalog-diagram':'Каталожный рисунок',
    'manufacturer-illustration':'Материал изготовителя',
    'product-photo':'Фото детали из каталога'
  };
  let current=null;
  function render(part,db,media,photo,sourceLink) {
    current={part,db,media,photo,sourceLink};
    const library=db.visuals;
    if(!library)return '';
    const assets=library.assets.filter(a=>a.status==='accepted'&&a.uses[part.id]);
    const count=role=>assets.filter(a=>a.uses[part.id].includes(role)).length;
    const category=selected.get(part.id)||library.categories.find(c=>count(c.id))?.id||'overall';
    const active=library.categories.find(c=>c.id===category);
    const visible=assets.filter(a=>a.uses[part.id].includes(category));
    const jump=category==='mechanism'?(part.explanation?`<p><a href="#construction">${esc(part.explanation.title)} ↑</a></p>`:'<p><a href="#motion">Посмотреть движение в общей модели ↑</a></p>'):category==='procedure'?'<p><a href="#service">Открыть порядок снятия и установки ↑</a></p>':'';
    return `<section class="panel visual-library" id="appearance" data-visual-part="${esc(part.id)}">
      <p class="eyebrow">Узнать деталь</p><h2>Фотографии и схемы</h2>
      <p class="muted">Выберите назначение изображения; нажмите на фото, чтобы рассмотреть его крупнее.</p>
      <div class="visual-tabs" role="tablist" aria-label="Назначение изображения">${library.categories.map(c=>`<button id="visual-tab-${c.id}" role="tab" data-visual-role="${c.id}" aria-selected="${c.id===category}" aria-controls="visual-content" tabindex="${c.id===category?0:-1}">${esc(c.title)} <span class="visual-count">${count(c.id)}</span></button>`).join('')}</div>
      <div id="visual-content" class="visual-content" role="tabpanel" aria-labelledby="visual-tab-${category}" tabindex="0">
        <h3 class="visual-section-title">${esc(active?.title)}</h3><p class="muted">${esc(active?.description)}</p>${jump}
        ${visible.length?visible.map(a=>{
          const original=media[a.mediaGroup]?.[a.mediaKey];
          const src=typeof original==='string'?original:original?.data;
          const caption=[a.captions?.[part.id]||a.caption,a.boundary].filter(Boolean).join(' ');
          return `<article class="visual-asset" data-visual-asset="${esc(a.id)}" data-origin="${esc(a.kind)}">${photo(src,a.title,caption,labels[a.kind]||a.kind)}<div class="visual-provenance">${(a.sourceIds||[]).map(sourceLink).join(' · ')}${a.sourceUrl?` <a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">Исходное изображение / страница ↗</a>`:''}<small>${esc(a.scope)}${a.view?' · '+esc(a.view):''}</small></div></article>`;
        }).join(''):`<div class="empty">${esc(active?.empty||'Подтверждённого изображения для этого раздела пока нет.')}</div>`}
        ${category==='reference'?`<div class="sources">${part.technicalSources.map(sourceLink).join(' · ')}</div>`:''}
      </div>
      <p class="notice visual-policy">Непроверенные генерации исправного и повреждённого вида скрыты; оригинальные фотографии вашего автомобиля находятся в разделе «Моё авто».</p>
    </section>`;
  }
  function choose(role,focus=false) {
    if(!current||!current.db.visuals.categories.some(c=>c.id===role))return;
    selected.set(current.part.id,role);
    const section=document.getElementById('appearance');
    if(section)section.outerHTML=render(current.part,current.db,current.media,current.photo,current.sourceLink);
    if(focus)document.getElementById('visual-tab-'+role)?.focus();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-visual-role]');
    if(button)choose(button.dataset.visualRole);
  });
  document.addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-visual-role]');
    if(!tab||!current)return;
    const ids=current.db.visuals.categories.map(c=>c.id),i=ids.indexOf(tab.dataset.visualRole);
    const next=event.key==='ArrowRight'?ids[(i+1)%ids.length]:event.key==='ArrowLeft'?ids[(i+ids.length-1)%ids.length]:event.key==='Home'?ids[0]:event.key==='End'?ids.at(-1):null;
    if(next){event.preventDefault();choose(next,true);}
  });
  globalThis.SerenaVisuals={render};
})();
