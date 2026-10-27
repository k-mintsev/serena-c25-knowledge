/* Educational axial section, not measured NC25 geometry or a vehicle dynamics model. */
(() => {
  'use strict';
  let cleanup=()=>{};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function svg(width, mode) {
    const w=Math.max(260,Math.round(width)), x=w*.48, cy=185, removed=mode==='removed', press=mode==='press';
    const shaftVisible=!removed&&!press, out=mode==='withdrawn', risk=mode==='risk', protector=mode==='insert';
    const tip=w*(out ? .65 : .08), shoulder=tip+w*.27, end=w-16, sx=removed?w*.24:0;
    const line=(x1,y1,x2,y2,extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`;
    const number=(n,px,py)=>`<g class="seal-number"><circle cx="${px}" cy="${py}" r="10"/><text x="${px}" y="${py+4}" text-anchor="middle">${n}</text></g>`;
    const arrow=(a,b,y)=>`<g class="seal-motion">${line(a,y,b,y)}<path d="M${b+(b>a?-7:7)},${y-5} L${b},${y} L${b+(b>a?-7:7)},${y+5}"/></g>`;
    let shaft='';
    if(shaftVisible){
      shaft=`<g data-shaft transform="${risk?`rotate(9 ${x} ${cy})`:''}"><path class="seal-shaft" d="M${tip},173 H${shoulder-12} L${shoulder},161 H${end} V209 H${shoulder} L${shoulder-12},197 H${tip}Z"/>`;
      for(let i=0;i<6;i++){const a=tip+5+i*w*.028;if(a<Math.min(shoulder-14,end))shaft+=line(a,175,a,195,'class="seal-spline"');}
      if(tip+18<end)shaft+=`<path class="seal-clip" d="M${tip+18},172 v-5 h6 v5 M${tip+18},198 v5 h6 v-5"/>`;
      shaft+='</g>';
    }
    let seal=`<g data-seal transform="translate(${sx} 0)">`;
    for(const sign of [-1,1]){
      const y=v=>cy+sign*v;
      seal+=`<path class="seal-elastomer" d="M${x-23},${y(74)} H${x+24} V${y(36)} L${x+17},${y(24)} L${x+10},${y(34)} V${y(53)} H${x+2} L${x-7},${y(24)} L${x-15},${y(30)} L${x-4},${y(57)} H${x-23}Z"/>`;
      seal+=`<path class="seal-case" d="M${x-18},${y(69)} H${x+18} V${y(51)}"/><circle class="seal-spring" cx="${x-4}" cy="${y(40)}" r="5"/>`;
    }
    seal+='</g>';
    let tools='';
    if(press){for(const yy of [114,243])tools+=`<rect class="seal-tool" x="${x+25}" y="${yy}" width="${Math.min(100,w*.25)}" height="13"/>`;tools+=arrow(x+100,x+40,97);}
    if(protector)tools+=`<path class="seal-protector" d="M${x-57},170 L${x-20},157 H${x+4} M${x-57},200 L${x-20},213 H${x+4}"/>`;
    if(out)tools+=arrow(x+32,w-20,310);
    if(removed)tools+=arrow(x+30,x+sx,310);
    if(protector)tools+=arrow(w-22,x+55,310);
    const damage=risk?`<path class="seal-risk" d="M${x-13},157 l13,12 m0,-12 l-13,12"/>`:'';
    return `<svg class="seal-section" viewBox="0 0 ${w} 334" width="${w}" height="334" role="img" aria-label="Учебный продольный разрез: корпус CVT, сальник с пружиной, гладкая шейка, шлицы и отдельный стопор привода. Размеры и форма условные."><title>Сальник и привод: разрез</title><text class="seal-direction" x="12" y="24">Внутри CVT</text><text class="seal-direction" x="${w-12}" y="24" text-anchor="end">К колесу →</text><path class="seal-fluid" d="M12,61 H${x-24} V157 H12Z M12,213 H${x-24} V296 H12Z"/><path class="seal-housing" d="M${x-49},74 H${x+53} V111 H${x-49}Z M${x-49},259 H${x+53} V296 H${x-49}Z"/><path class="seal-gear" d="M${w*.15},158 H${w*.28} V171 H${w*.15}Z M${w*.15},199 H${w*.28} V212 H${w*.15}Z"/>${shaft}${seal}${tools}${damage}<g class="seal-guides">${line(12,cy,w-12,cy,'stroke-dasharray="5 5"')}${number(1,x+38,90)}${number(2,x+sx-28,150)}${number(3,x+sx-8,132)}${shaftVisible&&shoulder+20<end?number(4,Math.min(end-14,shoulder+55),cy):''}${shaftVisible&&tip+w*.12<end?number(5,tip+w*.12,cy):''}${shaftVisible&&tip+21<end?number(6,tip+21,226):''}</g></svg>`;
  }
  function mount(root, config) {
    if(!root||!config?.stages?.length)return;
    cleanup();
    const stages=config.stages;
    root.classList.add('seal-diagram');
    root.innerHTML=`<div class="viz-controls"><label class="form-label">Состояние соединения <select class="form-select" data-seal-state>${stages.map((s,i)=>`<option value="${i}">${esc(s.title)}</option>`).join('')}</select></label></div><div data-seal-canvas></div><p class="seal-detail" data-seal-detail aria-live="polite"></p><ol class="seal-legend">${config.legend.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`;
    const picker=root.querySelector('[data-seal-state]'), canvas=root.querySelector('[data-seal-canvas]'), detail=root.querySelector('[data-seal-detail]');
    let index=0, revision=0;
    const render=()=>{canvas.innerHTML=svg(canvas.clientWidth||root.clientWidth,stages[index].mode);detail.textContent=stages[index].displayDetail||stages[index].detail;root.dataset.sealMode=stages[index].mode;};
    const apply=saved=>{const value=saved?.privateContent?.sealStage, incoming=saved?.privateContent?.sealRevision||0;if(incoming<revision)return;if(Number.isInteger(value)&&value>=0&&value<stages.length){revision=incoming;index=value;picker.value=String(index);render();}};
    picker.addEventListener('change',()=>{index=Number(picker.value);revision=Math.max(Date.now(),revision+1);render();window.openai?.setWidgetState?.({modelContent:{sealState:stages[index].title},privateContent:{sealStage:index,sealRevision:revision}})?.catch(()=>{});});
    render();apply(window.openai?.widgetState);
    const observer=new ResizeObserver(()=>{if(!root.isConnected){observer.disconnect();return;}render();});observer.observe(root);
    const onGlobals=event=>apply(event.detail?.globals?.widgetState);
    window.addEventListener('openai:set_globals',onGlobals);
    cleanup=()=>{observer.disconnect();window.removeEventListener('openai:set_globals',onGlobals);};
  }
  globalThis.SerenaSealDiagram={mount,svg};
})();
