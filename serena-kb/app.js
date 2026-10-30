/* The three views render the same solved pose. Data lives in data/serena-vehicle-kb.json. */
(() => {
  'use strict';
  const {db,media,routes}=SerenaData;
  const pageKind=document.body.dataset.page;
  const byId = Object.fromEntries(db.components.map(p => [p.id, p]));
  const hierarchy=SerenaHierarchy.create(db);
  const pageSystem=db.systems.find(s=>s.id===pageKind);
  const isContextPage=pageSystem?.status==='partial';
  const pageParts=()=>hierarchy.pageParts(pageKind);
  const belongsToPage=id=>!!byId[id]&&(byId[id].system===pageKind||(isContextPage&&pageSystem.contextParts?.includes(id)));
  const partRoute=id=>routes[db.systems.find(s=>s.status==='partial'&&s.contextParts?.includes(id))?.id||byId[id].system]+'#part='+id;
  const views = {front:'Спереди',side:'Сбоку · левая сторона',top:'Сверху'};
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2}).format(value);
  const date = value => value ? value.split('-').reverse().join('.') : 'не записана';
  const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  const sourceLink = id => {
    const s = db.sources[id];
    return s ? id === 'quote' ? `<a href="${esc(media.orderPdf)}" download="Заказ-наряд-8482.pdf">${esc(s.title)} · PDF ↓</a>` : link(s.url,s.title) : '';
  };
  const sim = new SerenaModel.VehicleSimulation({drivetrain:db.vehicleArchitecture.drivetrain});
  const drivetrainInputs={ratioPosition:0,gear:'D',converter:'fluid',rearProtection:false};
  let driveTempo=4;
  let selected = 'a1', system = 'front', view = 'top', running = false, scenario = 'bump', elapsed = 0;
  let amplitude = .12, rack = 0, previousTime = 0, lastDraw = 0, isolated = true;
  let vehicle = sim.snapshot(), scene = vehicle.axles.front;
  let scope='assembly';
  const visibility={shell:'ghost',structure:true,mounts:true,wheels:true,otherAxle:true,powertrain:true,future:false};
  const hiddenParts=new Set();
  let imageMap = new Map();
  let imageCounter = 0;

  const mechanics = {
    a1:'Подрамник остаётся жёсткой опорой: рычаги поворачиваются относительно него, а не двигают его по отдельной траектории. Четыре опоры связывают раму с кузовом.',
    a2:'Задняя пара из четырёх опор связывает передний подрамник с кузовом. Резина допускает небольшие упругие смещения и изолирует вибрации.',
    g1:'Это передняя пара из четырёх опор переднего подрамника. Не путайте их с двумя сайлентблоками каждого нижнего рычага.',
    a3:'Два внутренних шарнира задают ось поворота нижнего рычага; шаровая на внешнем конце ведёт кулак. При ходе колеса металлический рычаг сохраняет свою геометрию.',
    a4:'Передний сайлентблок вместе с задним задаёт ось поворота рычага. Металлическая втулка закреплена, а резина деформируется при ходе подвески; отдельное скольжение в ней не задаётся.',
    a5:'Задний сайлентблок нижнего рычага принимает продольные и боковые усилия и допускает поворот рычага. Его отрыв может менять положение колеса под нагрузкой.',
    a6:'Шаровая соединяет рычаг с кулаком: центр шарнира следует за рычагом, а кулак одновременно поворачивается и меняет наклон. Пыльник удерживает смазку и защищает шарнир.',
    b1:'Пружина меняет длину между верхней и нижней чашками. Сжатие создаёт возвращающее усилие; именно это удерживает массу кузова, а не амортизатор.',
    b2:'Стойка направляет кулак и телескопически меняет длину. Демпфирующее усилие зависит от скорости сжатия/отбоя: остановленное сжатие само по себе не создаёт такого усилия.',
    b3:'Верхняя опора связывает стойку с кузовом, подшипник даёт стойке поворачиваться при рулении. Включите «Руление», чтобы увидеть поворот кулака и колеса.',
    b4:'Пыльник закрывает шток при изменении длины стойки. Отбойник ограничивает большой ход сжатия; отбойник включается у края хода сжатия.',
    b5:'Резиновая прокладка находится между пружиной и чашкой: передаёт нагрузку и уменьшает контакт металла с металлом. Она следует за своей чашкой.',
    b6:'Стабилизатор связан с обеими сторонами через стойки. При одинаковом ходе колёс скручивание мало; при разном — появляется противодействующий момент. Сравните «Оба колеса» и «Перекос».',
    c1:'Втулки и хомуты держат стабилизатор на подрамнике и позволяют ему поворачиваться. Они не являются четырьмя опорами самого подрамника.',
    c2:'Стойка передаёт усилие от движущейся стойки подвески к плечу стабилизатора. Её длина сохраняется, шарниры на концах меняют угол.',
    c3:'Кулак объединяет ступицу, нижнюю шаровую, стойку и рулевой наконечник. Движется как жёсткая деталь, позволяя колесу поворачивать и проходить неровности.',
    c4:'Ступица вращается в подшипнике относительно кулака. В режиме «Вращение привода» вращение колеса показано отдельно от хода подвески.',
    c5:'Рейка сдвигает внутренние шарниры рулевых тяг. Тяги сохраняют длину и поворачивают кулаки; углы колёс получаются из геометрии, не задаются независимо.',
    c6:'Наружный наконечник соединяет тягу с рычагом кулака. Шарнир меняет угол при ходе и рулении, сохраняя заданную длину рулевой цепочки.',
    d1:'Внутренний шарнир тяги следует за рейкой, наружный — за кулаком. Положение наконечника и длина тяги определяют схождение; люфт не является нормальным движением.',
    d2:'Гофра защищает рейку и внутренний шарнир тяги. При сдвиге рейки её рабочая длина меняется; она не должна содержать смазку ШРУСа.',
    d3:'Левый привод передаёт вращение от трансмиссии к колесу. Внутренний шарнир допускает осевую компенсацию, наружный — большой угол при рулении; стальной вал не растягивается.',
    d4:'Наружный ШРУС передаёт вращение к поворачивающемуся колесу. Угол между приводом и осью ступицы меняется при ходе и рулении.',
    d5:'Внутренний шарнир допускает изменение угла и осевую компенсацию длины всей цепочки.',
    d6:'Наружный пыльник следует за изменением угла ШРУСа и удерживает смазку. Его разрыв не доказывает износ самого шарнира: нужны очистка, осмотр и проверка.',
    e1:'Задний подрамник NC25 несёт связи независимой задней подвески 4WD. На NC25 4WD применяется независимая многорычажная задняя подвеска.',
    e2:'Продольный рычаг с держателем ступицы ведёт колесо относительно переднего шарнира. Поперечные связи дополнительно ограничивают положение и наклон этого узла.',
    e3:'Верхняя поперечная связь ограничивает положение верхней части держателя ступицы. Она сохраняет длину, а шарниры меняют угол.',
    e4:'Нижняя поперечная связь совместно с верхней и продольной ведёт колесо. Рычаги совместно удерживают положение колеса при ходе подвески.',
    e5:'Задняя пружина стоит отдельно от амортизатора, опираясь на рычаг. Её сжатие возвращает кузов; верхняя и нижняя точки движутся относительно друг друга.',
    e6:'Задний амортизатор отдельно соединяет кузов с движущимся узлом и гасит скорость колебаний. Его длина меняется совместно с ходом пружины и рычагов.',
    f1:'Задний стабилизатор связывает левую и правую стороны. Противодействие зависит от разницы хода, а не просто от того, что автомобиль поднялся на кочку.',
    f2:'Втулки с хомутами удерживают задний стабилизатор на опоре, позволяя ему поворачиваться.',
    f3:'Задняя стойка связывает движущийся узел и плечо стабилизатора, передавая усилие при разном ходе колёс.',
    f4:'Задняя ступица вращается в подшипнике держателя. Сама ось следует за движением рычагов; вращение колеса и ход подвески — разные движения.',
    f5:'Задний привод 4WD передаёт вращение к колесу, сохраняя возможность хода подвески. Шарниры меняют угол, внутреннее соединение компенсирует длину.',
    f6:'Передний сайлентблок продольного заднего рычага позволяет направляемое движение рычага и изолирует вибрации.',
    g2:'Задняя реактивная опора ограничивает качание силового агрегата под тягой.',
    g3:'Внутренний пыльник закрывает шарнир с осевой компенсацией: меняются и угол, и рабочая длина гофры. Это отдельная деталь от наружного пыльника из наряда.',
    g4:'Сальник работает у выхода левого привода из CVT: его корпус неподвижен, хвостовик внутреннего ШРУСа вращается внутри рабочей кромки. Уплотнение удерживает жидкость; механическая фиксация привода выполняется отдельно.'
  };

  function photo(src,title,caption,tag='') {
    if(!src)return `<div class="empty">Изображение не подтверждено.</div>`;
    const key = 'image-'+(++imageCounter);
    imageMap.set(key,{src,title});
    return `<figure class="image-card"><button data-image="${key}" aria-label="Увеличить: ${esc(title)}"><img src="${esc(src)}" alt="${esc(title)}" loading="lazy"></button><figcaption>${tag?`<span class="tag ${tag==='Учебное повреждение'?'damage':''}">${esc(tag)}</span>`:''}<h3>${esc(title)}</h3>${esc(caption)} <span class="muted">Нажмите для увеличения.</span></figcaption></figure>`;
  }
  function modelPanel() {
    const groups=db.assemblies.filter(a=>a.system===system);
    return `<section class="panel" id="motion">
      <div class="modelheader"><div><p class="eyebrow">Единый автомобиль · три проекции</p><h2>Как узел закреплён и работает</h2></div>
      <div class="viewtabs" aria-label="Ракурс">${Object.entries(views).map(([id,name])=>`<button data-view="${id}" aria-pressed="${id===view}">${name.split(' · ')[0]}</button>`).join('')}</div></div>
      <p class="muted">Кузов и обе подвески находятся в одной сцене; выбранная деталь выделена, соседние крепления видны для связи с автомобилем.</p>
      <div class="scene-toolbar"><label>Масштаб обзора <select id="scene-scope"><option value="assembly" ${scope==='assembly'?'selected':''}>Крупно узел</option><option value="vehicle" ${scope==='vehicle'?'selected':''}>Автомобиль целиком</option></select></label><span class="muted">В миниатюрах — тот же автомобиль целиком</span></div>
      <div class="model-stage"><div id="model-main"></div><div class="stage-caption"><span id="view-caption"></span><span>Одна система координат · размеры учебные</span></div></div>
      <div class="previewrow" id="model-previews"></div>
      <details class="layer-panel"><summary>Видимость: кузов, колёса и отдельные детали</summary>
      <div class="layer-controls"><label>Кузов <select id="shell-mode"><option value="ghost" ${visibility.shell==='ghost'?'selected':''}>Прозрачный</option><option value="outline" ${visibility.shell==='outline'?'selected':''}>Только контур</option><option value="hidden" ${visibility.shell==='hidden'?'selected':''}>Скрыть</option></select></label>
      ${[['structure','Силовая структура кузова'],['mounts','Кронштейны и точки крепления'],['wheels','Колёса'],['otherAxle','Вторая ось сбоку и сверху'],['powertrain','Корпуса у выходов приводов'],['future','Места будущих систем']].map(([id,name])=>`<label><input type="checkbox" data-layer-toggle="${id}" ${visibility[id]?'checked':''}>${name}</label>`).join('')}</div>
      <div class="hide-controls"><select id="mask-part" aria-label="Деталь для скрытия">${db.assemblies.map(a=>{const ids=[a.root,...a.children].filter(id=>byId[id].contentStatus!=='placeholder');return ids.length?`<optgroup label="${esc(a.name)}">${ids.map(id=>`<option value="${id}" ${id===selected?'selected':''}>№${byId[id].number} ${esc(byId[id].name)}</option>`).join('')}</optgroup>`:'';}).join('')}</select><button id="hide-part">Скрыть деталь</button><button id="restore-parts">Вернуть детали</button></div><p id="hidden-summary" class="muted"></p></details>
      <div class="controls"><button class="primary" id="play" aria-pressed="${running}">${running?'Ⅱ Пауза':'▶ Запустить'}</button><button id="reset">Сброс движения</button><select id="scenario" aria-label="Режим движения"><option value="bump">Наезд левыми колёсами по очереди</option><option value="both">Наезд двумя колёсами оси</option><option value="roll">Перекос колёс</option><option value="steer">Руление передними колёсами</option><option value="drive">Вращение приводов</option></select></div>
      <div class="slider-row"><label>Высота неровности <output id="amp-value">${fmt(amplitude)}</output><input id="amplitude" aria-label="Высота неровности" type="range" min="0" max="0.16" step="0.01" value="${amplitude}"></label><label>Положение рулевой рейки <output id="rack-value">${fmt(rack)}</output><input id="rack" aria-label="Положение рулевой рейки" type="range" min="-0.14" max="0.14" step="0.01" value="${rack}"></label></div>
      ${byId[selected].explanation?.drivetrain?`<div class="drivetrain-controls"><label>Направление <select id="drive-gear" aria-label="Направление вращения"><option value="D">D · вперёд</option><option value="N">N · без тяги</option><option value="R">R · назад</option></select></label><label>Гидротрансформатор <select id="drive-converter" aria-label="Состояние гидротрансформатора"><option value="fluid">Передача через жидкость</option><option value="locked">Блокировка замкнута</option></select></label><label>От трогания к быстрому ходу <output id="drive-ratio-value"></output><input id="drive-ratio" aria-label="Передаточное отношение CVT" type="range" min="0" max="1" step="0.01" value="${drivetrainInputs.ratioPosition}"></label><label>Темп показа <output id="drive-tempo-value">${fmt(driveTempo)}×</output><input id="drive-tempo" aria-label="Темп показа вращения" type="range" min="1" max="8" step="0.5" value="${driveTempo}"></label><label class="drivetrain-protection"><input id="drive-protection" type="checkbox">Показать защитное отключение задней тяги</label><p>Это состояния объясняющей схемы; на C25 водитель не переключает полный привод вручную.</p></div>`:''}
      <div class="mechanism" id="mechanism-explanation"></div><div class="metrics" id="metrics"></div>
      <details><summary>Пружины, демпфирование и стабилизатор: изменить модель</summary><div class="slider-row">${[['spring','Жёсткость пружин',.3,2.5],['damping','Демпфирование',0,2.5],['antiroll','Жёсткость стабилизатора',0,2.5]].map(([id,name,min,max])=>`<label>${name} <output id="${id}-value">${fmt(sim.params[id])}×</output><input id="${id}" type="range" min="${min}" max="${max}" step="0.1" value="${sim.params[id]}" aria-label="${name}"></label>`).join('')}</div><p class="modelnotes">Один кузов связан с четырьмя колёсами; изменяются его подъём, крен и продольный наклон. 1× — учебная база, а не характеристика штатной детали.</p></details>
      <details><summary>Что рассчитано, что упрощено · расширение автомобиля</summary><div class="modelnotes"><p>Все три ракурса и крупные планы показывают одну геометрию. Колёса, рычаги и стойки подчиняются общим связям, а их верхние и внутренние опоры закреплены в едином кузове. Наезд задней оси происходит после передней с учебной задержкой; это не измеренная скорость автомобиля.</p><p>Кузов имеет одну позу с подъёмом, креном и тангажом; четыре неподрессоренные массы действуют на него через пружины, демпферы и стабилизаторы. Длины металлических рычагов и рулевых тяг сохраняются, стойки и внутренние шарниры допускают нужные изменения длины.</p><p>Силуэт кузова, кронштейны и формы деталей приблизительные. Численные размеры, упругость реальных сайлентблоков и масса вашей машины не измерены. Задний резиновый шарнир идеализирован сферическим, поперечные связи обобщены. Это объясняющая модель, не расчёт прочности, развала или ресурса.</p><p>Для двигателя, CVT и дальнейшего привода зарезервированы узлы и соединительные порты в той же системе координат. Сейчас видны только условные корпуса в местах соединения приводов; точная форма и внутренняя работа этих агрегатов ещё не построены.</p><p>Состав узлов: ${link('https://nissan.epc-data.com/serena/nc25/7181-mr20de/trans/401/?frame_no=NC25-002639','передняя подвеска NC25')}, ${link('https://nissan.epc-data.com/serena/nc25/7181-mr20de/trans/431/?frame_no=NC25-002639','задняя подвеска NC25')}. Принципы: ${sourceLink('mathworks')}, ${sourceLink('quarter')}.</p><p id="status"></p></div></details></section>`;
  }
  function renderNavigation() {
    $('systems').innerHTML=`<a class="system ${pageKind==='vehicle'?'active':''}" data-whole-vehicle href="${routes.vehicle}">Автомобиль<small>Все узлы в одной сцене</small></a>`+db.systems.map(s=>`<a class="system ${s.id===pageKind?'active':''}" data-system="${s.id}" href="${routes[s.id]}" ${s.id===pageKind?'aria-current="page"':''}>${esc(s.name)}${s.status==='future'?'<small>Раздел для будущих материалов</small>':s.status==='partial'?`<small>${esc(s.contextTitle)}</small>`:''}</a>`).join('');
    if(pageKind==='vehicle'){
      $('list-title').textContent='Системы автомобиля';
      $('part-list').innerHTML=db.systems.map(s=>`<a class="part-link system-shortcut" href="${routes[s.id]}">${esc(s.name)}<small>${hierarchy.pageParts(s.id).length||'в будущем'}</small></a>`).join('');return;
    }
    const parts=pageParts(),groups=hierarchy.groupsFor(parts);
    $('list-title').textContent=pageSystem.name;
    function groupIds(group) {
      return [...hierarchy.members(group,parts).map(p=>p.id),...hierarchy.subgroups(group,groups).flatMap(groupIds)];
    }
    function groupTree(group) {
      const rows=hierarchy.rows(group,parts),nested=hierarchy.subgroups(group,groups),ids=groupIds(group);
      return `<details class="assembly-group" data-assembly="${esc(group.id)}" ${ids.includes(selected)?'open':''}><summary>${esc(group.name)}<small>${ids.length}</small></summary><div class="assembly-parts">${rows.map(({part:p,depth})=>`<button class="part-link ${p.id===selected?'active':''} ${p.id===group.root?'assembly-root':p.parentId?'assembly-child':'assembly-sibling'}" style="--part-depth:${depth}" data-select="${p.id}" ${p.id===selected?'aria-current="true"':''}><span class="num">${p.number}</span><span>${esc(p.name)}</span></button>`).join('')}${nested.map(groupTree).join('')}</div></details>`;
    }
    $('part-list').innerHTML=hierarchy.roots(groups).map(groupTree).join('');
  }
  function renderCard() {
    imageMap=new Map();imageCounter=0;
    document.body.classList.add('reader-page');renderNavigation();
    const p=byId[selected];
    $('main').innerHTML=SerenaReader.render(p,db,media,{photo,sourceLink,fmt,date,hierarchy,model:p.contentStatus==='placeholder'?'':SerenaReader.model(modelPanel(),p),mechanics:mechanics[p.id],pageSystem,pageParts:pageParts(),partRoute});
    if($('motion'))setupModelControls();
    if(p.explanation?.diagram)SerenaSealDiagram.mount($('seal-cutaway'),p.explanation.diagram);
    refreshScene();draw();
  }

  function setupModelControls(){
    $('scenario').value=scenario;
    const overview=document.createElement('button');overview.id='overview';overview.textContent=isolated?'Показать все узлы':'Выделить деталь';overview.setAttribute('aria-pressed',String(!isolated));
    document.querySelector(document.body.classList.contains('reader-page')?'.layer-panel .hide-controls':'.controls').append(overview);
    $('play').textContent=running?'Ⅱ Пауза':'▶ Запустить';
    $('play').setAttribute('aria-pressed',String(running));
    if($('drive-gear')){
      $('drive-gear').value=drivetrainInputs.gear;$('drive-converter').value=drivetrainInputs.converter;
      $('drive-protection').checked=drivetrainInputs.rearProtection;
    }
    syncDrivetrain();
  }
  function renderHome(){
    imageMap=new Map();imageCounter=0;document.body.classList.add('reader-page');renderNavigation();
    const v=db.vehicle,name=SerenaReader.vehicleName(db),facts=[name,v.year,v.drive,v.engine,v.transmission].filter(Boolean).join(' · ');
    $('main').innerHTML=`<div class="reader-heading" id="description"><p class="reader-breadcrumb">${esc(name)}</p><h1>Автомобиль в деталях</h1></div>${SerenaReader.model(modelPanel(),{presentation:{modelTitle:'Автомобиль в движении'}})}<section class="panel reader-section"><h2>Разделы автомобиля</h2><div class="system-cards">${db.systems.map(s=>`<a href="${routes[s.id]}" class="system-card"><h3>${esc(s.name)}</h3><p>${s.contextTitle?esc(s.contextTitle):s.id==='front'?'Рычаги, стойки, рулевое управление и приводы':'Рычаги, пружины, амортизаторы и ступицы'}</p><span>Открыть →</span></a>`).join('')}</div></section><section class="panel reader-section"><h2>Моя машина</h2><ul><li>${esc(facts)}</li>${v.reportedMileageKm!==null?`<li>Пробег — ${v.mileageVerified?'':'около '}${fmt(v.reportedMileageKm)} км${v.mileageVerified?'':' со слов владельца'}.</li>`:''}</ul></section><details class="panel reader-sources" id="sources"><summary>Источники <span>Документы машины</span></summary><div class="reader-source-content"><p>${sourceLink('quote')}</p></div></details>`;
    setupModelControls();refreshScene();draw();
  }

  function refreshScene(){vehicle=sim.snapshot();scene=vehicle.axles[byId[selected].system]||vehicle.axles.front;}
  function syncDrivetrain(){
    sim.step(0,{...sim.inputs,rack,...drivetrainInputs,drive:scenario==='drive'?driveTempo:0});
    if($('drive-ratio')){
      $('drive-ratio').disabled=drivetrainInputs.gear==='R';
      $('drive-converter').disabled=drivetrainInputs.gear!=='D';
      $('drive-ratio-value').textContent=fmt(sim.drivetrain.snapshot().ratio);
    }
  }
  function renderModel(viewName,preview=false){
    return SerenaVehicleView.render(vehicle,{view:viewName,selected,parts:byId,assemblies:db.assemblies,isolated,scope,visibility,hiddenParts,reader:document.body.classList.contains('reader-page')},preview);
  }
  function draw() {
    if(!$('model-main'))return;
    $('model-main').innerHTML=renderModel(view);
    if($('drivetrain-cutaway'))$('drivetrain-cutaway').innerHTML=SerenaDrivetrainView.render(vehicle,db.vehicleArchitecture.drivetrainPresentation);
    $('view-caption').textContent=document.body.classList.contains('reader-page')?views[view]:`${views[view]} · №${byId[selected].number} ${byId[selected].name}${view==='front'?' · противоположная подвеска скрыта':view==='side'?' · правая половина скрыта':''}`;
    if($('model-previews'))$('model-previews').innerHTML=Object.keys(views).filter(x=>x!==view).map(x=>`<button class="view-preview" data-view="${x}" aria-label="Показать ракурс: ${views[x]}">${renderModel(x,true)}<span>${views[x]} ↗</span></button>`).join('');
    document.querySelectorAll('.viewtabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    if($('mechanism-explanation'))$('mechanism-explanation').innerHTML=`<p>${esc(mechanics[selected]||byId[selected].description)}</p>${byId[selected].connections?`<p class="attachment-note"><strong>Как закреплено:</strong> ${esc(byId[selected].connections)}</p>`:''}`;
    $('hidden-summary').textContent=hiddenParts.size?'Скрыты: '+[...hiddenParts].map(id=>'№'+byId[id].number+' '+byId[id].name).join('; '):document.body.classList.contains('reader-page')?'':'Все детали доступны; слои меняют видимость, но не геометрию и крепления.';
    if(!$('metrics'))return;
    const w=scene.wheels.L,values=[];
    const metric=(label,value)=>values.push(`<div class="metric">${label}<strong>${value}</strong></div>`);
    metric('Ход колеса Л / П',`${fmt(scene.mechanics.travelL)} / ${fmt(scene.mechanics.travelR)}`);
    if(['b1','e5'].includes(selected)) {metric('Длина пружины',fmt(w.springLength));metric('Усилие пружины',fmt(w.forces.spring));}
    else if(['b2','e6','b4'].includes(selected)) {metric('Скорость сжатия',fmt(w.velocity));metric('Усилие демпфера',fmt(w.forces.damper));if(selected==='b4')metric('Усилие отбойника',fmt(w.forces.bumpStop));}
    else if(['b6','c1','c2','f1','f2','f3'].includes(selected)) {metric('Разность углов плеч',`${fmt(scene.mechanics.antirollAngle*180/Math.PI)}°`);metric('Усилие стабилизатора Л',fmt(w.forces.antiroll));}
    else if(['d3','d4','d5','d6','g3','f5','g4'].includes(selected)) {metric('Угол наружного ШРУСа',`${fmt(w.cv.outerAngle*180/Math.PI)}°`);metric('Осевое смещение',fmt(w.cv.plunge));}
    else if(scene.axle==='front')metric('Угол колеса Л / П',`${fmt(w.steer*180/Math.PI)}° / ${fmt(scene.wheels.R.steer*180/Math.PI)}°`);
    metric('Геометрические связи',scene.solver.ok?'соблюдены':'достигнут предел');
    $('metrics').innerHTML=values.join('');
    $('status').textContent=`Решатель: ${scene.solver.ok?'допустимая поза':'ограничение, сохранена последняя допустимая поза'}; максимальная невязка ${scene.solver.maxError.toExponential(2)} нормированных единиц. Реальные координаты и характеристики подвески пока не измерены.`;
  }
  function selectPart(id,scroll=false,procedure=null) {
    if(!byId[id])return;
    if(!belongsToPage(id)){location.assign(partRoute(id));return;}
    selected=id;system=byId[id].system;view=byId[id].bestView;isolated=true;scope='assembly';hiddenParts.delete(id);
    if(byId[id].explanation?.drivetrain)scenario='drive';
    try{localStorage.setItem('serena-kb-part',id);localStorage.setItem('serena-kb-part-'+pageKind,id);}catch{}
    const procedureId=(db.service.procedures||[]).some(p=>p.id===procedure)?procedure:null;
    history.replaceState(null,'',`#part=${id}${procedureId?'&procedure='+encodeURIComponent(procedureId):''}`);
    renderCard();
    if(scroll)window.scrollTo({top:0,behavior:'auto'});
  }
  function setView(id) {if(!views[id])return;view=id;draw();}
  function togglePlay() {
    running=!running;previousTime=0;
    $('play').textContent=running?'Ⅱ Пауза':'▶ Запустить';
    $('play').setAttribute('aria-pressed',String(running));
  }
  function reset() {sim.reset();elapsed=0;syncDrivetrain();refreshScene();draw();}
  function animate(now) {
    requestAnimationFrame(animate);
    if(!running){previousTime=now;return;}
    const dt=Math.min(.04,(now-(previousTime||now))/1000);previousTime=now;elapsed+=dt;
    const phase=elapsed%3.6,pulse=phase<1.4?Math.sin(Math.PI*phase/1.4)**2:0;
    let roadL=0,roadR=0,steer=rack,drive=0;
    if(scenario==='bump')roadL=amplitude*pulse;
    if(scenario==='both')roadL=roadR=amplitude*pulse;
    if(scenario==='roll'){roadL=amplitude*Math.sin(elapsed*2.2);roadR=-roadL;}
    if(scenario==='steer')steer=.14*Math.sin(elapsed*1.3);
    if(scenario==='drive')drive=driveTempo;
    const rearPhase=(elapsed-.85)%3.6,rearPulse=elapsed>.85&&rearPhase<1.4?Math.sin(Math.PI*rearPhase/1.4)**2:0;
    let roadRL=0,roadRR=0;
    if(scenario==='bump')roadRL=amplitude*rearPulse;
    if(scenario==='both')roadRL=roadRR=amplitude*rearPulse;
    if(scenario==='roll'){roadRL=roadL;roadRR=roadR;}
    sim.step(dt,{roadFL:roadL,roadFR:roadR,roadRL,roadRR,rack:steer,drive,...drivetrainInputs});
    if(now-lastDraw>40){refreshScene();draw();lastDraw=now;}
  }
  function exportData() {
    const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='serena-vehicle-kb-'+db.updated+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('click',e=>{
    const image=e.target.closest('[data-image]');
    if(image){const item=imageMap.get(image.dataset.image);if(item){$('zoom-title').textContent=item.title;$('zoom-image').src=item.src;$('zoom-image').alt=item.title;$('zoom').dataset.native='false';$('native-size').textContent='В натуральном размере';$('zoom').showModal();}return;}
    const preview=e.target.closest('.view-preview');if(preview){setView(preview.dataset.view);return;}
    const viewButton=e.target.closest('[data-view]');if(viewButton){setView(viewButton.dataset.view);return;}
    const part=e.target.closest('[data-part],[data-select]');if(part){selectPart(part.dataset.part||part.dataset.select);return;}
    if(e.target.closest('[data-prev],[data-next]')){const parts=hierarchy.ordered(pageParts()).flatMap(group=>group.rows.map(row=>row.part)),index=parts.findIndex(p=>p.id===selected);selectPart(parts[(index+(e.target.closest('[data-prev]')?-1:1)+parts.length)%parts.length].id);return;}
    if(e.target.id==='play')togglePlay();
    if(e.target.id==='overview'){isolated=!isolated;e.target.textContent=isolated?'Показать все узлы':'Выделить деталь';e.target.setAttribute('aria-pressed',String(!isolated));draw();}
    if(e.target.id==='hide-part'){hiddenParts.add($('mask-part').value);draw();}
    if(e.target.id==='restore-parts'){hiddenParts.clear();draw();}
    if(e.target.id==='reset')reset();
    if(e.target.id==='close-zoom')$('zoom').close();
    if(e.target.id==='native-size'){const native=$('zoom').dataset.native!=='true';$('zoom').dataset.native=String(native);e.target.textContent=native?'Вписать в окно':'В натуральном размере';}
    if(e.target.id==='export-kb')exportData();
  });
  document.addEventListener('keydown',e=>{const part=e.target.closest('[data-part]');if(part&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectPart(part.dataset.part);}});
  // Freeze the frame under the pointer so an animation redraw cannot remove a click target.
  document.addEventListener('pointerdown',e=>{if(running&&e.target.closest('#model-main,.view-preview'))togglePlay();});
  document.addEventListener('change',e=>{
    if(e.target.id==='part-picker')selectPart(e.target.value);
    if(e.target.id==='scene-scope'){scope=e.target.value;renderNavigation();draw();}
    if(e.target.id==='shell-mode'){visibility.shell=e.target.value;draw();}
    if(e.target.dataset.layerToggle){visibility[e.target.dataset.layerToggle]=e.target.checked;draw();}
    if(e.target.id==='scenario'){scenario=e.target.value;reset();}
    if(e.target.id==='drive-gear'||e.target.id==='drive-converter'||e.target.id==='drive-protection'){
      drivetrainInputs.gear=$('drive-gear').value;drivetrainInputs.converter=$('drive-converter').value;
      if(drivetrainInputs.gear!=='D')drivetrainInputs.converter='fluid';
      $('drive-converter').value=drivetrainInputs.converter;$('drive-converter').disabled=drivetrainInputs.gear!=='D';
      drivetrainInputs.rearProtection=$('drive-protection').checked;syncDrivetrain();refreshScene();draw();
    }
  });
  document.addEventListener('input',e=>{
    const id=e.target.id;
    if(id==='amplitude'){amplitude=+e.target.value;$('amp-value').textContent=fmt(amplitude);}
    if(id==='rack') {rack=+e.target.value;$('rack-value').textContent=fmt(rack);sim.step(0,{...sim.inputs,rack});refreshScene();draw();}
    if(id==='drive-ratio'||id==='drive-tempo'){
      drivetrainInputs.ratioPosition=+$('drive-ratio').value;driveTempo=+$('drive-tempo').value;
      $('drive-tempo-value').textContent=fmt(driveTempo)+'×';syncDrivetrain();refreshScene();draw();
    }
    if(['spring','damping','antiroll'].includes(id)){sim.setParameters({[id]:+e.target.value});$(id+'-value').textContent=fmt(+e.target.value)+'×';}
  });
  $('zoom').addEventListener('click',e=>{if(e.target===$('zoom'))$('zoom').close();});
  window.addEventListener('hashchange',()=>{const params=new URLSearchParams(location.hash.slice(1)),id=params.get('part');if(byId[id])selectPart(id,false,params.get('procedure'));});
  const initialParams=new URLSearchParams(location.hash.slice(1));
  let initial=initialParams.get('part');
  if(pageKind==='vehicle'&&byId[initial]){location.replace(partRoute(initial)+(initialParams.get('procedure')?'&procedure='+encodeURIComponent(initialParams.get('procedure')):''));return;}
  try{initial=initial||localStorage.getItem('serena-kb-part-'+pageKind)||localStorage.getItem('serena-kb-part');}catch{}
  if(pageKind==='vehicle'){
    selected=byId[initial]&&byId[initial].contentStatus!=='placeholder'?initial:'a1';system=byId[selected].system;scope='vehicle';view='side';isolated=false;renderHome();
  }else if(db.systems.find(s=>s.id===pageKind)?.status==='future'){
    system=pageKind;selected=db.systems.find(s=>s.id===pageKind).contextParts?.[0]||'a1';renderCard();
  }else{
    const first=pageParts()[0].id;
    selectPart(belongsToPage(initial)?initial:first,false,initialParams.get('procedure'));
  }
  requestAnimationFrame(animate);
  // Read-only inspection is useful for reproducible QA without reaching into closures.
  globalThis.SerenaKB={data:db,getState:()=>({page:pageKind,selected,system,view,running,scope,visibility:{...visibility},hiddenParts:[...hiddenParts],scene,vehicle}),selectPart};
})();
