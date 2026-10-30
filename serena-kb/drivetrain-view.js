/* A functional section of the same VehicleSimulation state, never a second animation clock. */
globalThis.SerenaDrivetrainView=(()=>{
  'use strict';
  const number=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
  const radToDeg=a=>a*180/Math.PI;
  const point=(x,y,r,a)=>[x+r*Math.cos(a),y+r*Math.sin(a)];
  function render(vehicle,copy){
    const d=vehicle.drivetrain,b=d.belt,scale=380,x1=115,x2=x1+b.distance*scale,y=160;
    const r=b.primary*scale,s=b.secondary*scale,a=Math.acos((r-s)/(x2-x1));
    const p=point(x1,y,r,-a),q=point(x2,y,s,-a),u=point(x2,y,s,a),v=point(x1,y,r,a);
    const path=`M${p} L${q} A${s},${s} 0 ${a>Math.PI/2?1:0} 1 ${u} L${v} A${r},${r} 0 ${a<Math.PI/2?1:0} 1 ${p}`;
    const rotor=(x,y,r,phase,color)=>`<g transform="translate(${x} ${y}) rotate(${radToDeg(phase)})" stroke="${color}"><circle r="${r}" fill="none" stroke-width="2"/><path d="M0 0 L${r} 0 M0 0 L${-.5*r} ${.866*r} M0 0 L${-.5*r} ${-.866*r}" stroke-width="5" stroke-linecap="round"/></g>`;
    const rear=d.rearDriven?'#5576a3':'#9aa8b0';
    const wheel=(id,x,y)=>`<g data-drive-wheel="${id}" data-phase="${d.phases[id]}" transform="translate(${x} ${y})"><rect x="-21" y="-12" width="42" height="24" rx="6" fill="#f0f4f5" stroke="#516878" stroke-width="3"/>${rotor(0,0,9,d.phases[id],'#087f87')}<text x="0" y="${y<100?-24:39}" text-anchor="middle" font-size="16" fill="#3d5561">${id}</text></g>`;
    const status=d.inputs.gear==='N'?copy.neutral:d.inputs.gear==='R'?copy.reverse:d.inputs.converter==='locked'?copy.locked:copy.fluid;
    return `<div class="drivetrain-section" data-drivetrain-time="${vehicle.time}" data-vehicle-id="${vehicle.id}">
      <p class="drivetrain-status">${status}</p>
      <div class="drivetrain-plots"><figure><figcaption>Шкивы и стальной ремень</figcaption>
      <svg viewBox="0 0 500 305" role="img" aria-label="${copy.beltLabel}" data-cvt-ratio="${d.ratio}">
        <g stroke="#c8d4da" fill="#edf2f4"><circle cx="${x1}" cy="${y}" r="${.29*scale}"/><circle cx="${x2}" cy="${y}" r="${.29*scale}"/></g>
        ${rotor(x1,y,r,d.phases.primary,'#087f87')}${rotor(x2,y,s,d.phases.secondary,'#b36b30')}
        <path d="${path}" stroke="#526575" stroke-width="9" fill="none"/>
        <path d="${path}" stroke="#fff" stroke-width="3" stroke-dasharray="2 12" stroke-dashoffset="${-d.phases.belt*scale}" fill="none"/>
        <text x="${x1}" y="28" text-anchor="middle" fill="#087f87" font-size="21">Ведущий</text><text x="${x2}" y="28" text-anchor="middle" fill="#935522" font-size="21">Ведомый</text>
        <text x="250" y="293" text-anchor="middle" fill="#3d5561" font-size="19">${d.inputs.gear==='R'?'← Задний ход':d.inputs.gear==='N'?'Нет тяги':'Передний ход →'}</text>
      </svg><p>${copy.ratio}</p></figure>
      <figure><figcaption>От трансмиссии к четырём колёсам</figcaption>
      <svg viewBox="0 0 500 305" role="img" aria-label="${copy.pathLabel}">
        <path d="M95 65 H405 M250 65 V112 H280 V150" stroke="#087f87" stroke-width="8" fill="none"/>
        <path d="M280 150 V220 H250 V245 M95 245 H405" stroke="${rear}" stroke-width="8" fill="none"/>
        <rect x="234" y="133" width="92" height="36" rx="8" fill="#fff" stroke="${rear}" stroke-width="3"/>
        ${rotor(250,65,20,d.phases.frontCarrier,'#087f87')}${rotor(250,245,20,d.phases.rearCarrier,rear)}
        ${wheel('FL',95,65)}${wheel('FR',405,65)}${wheel('RL',95,245)}${wheel('RR',405,245)}
        <text x="20" y="157" fill="#3d5561" font-size="18">Кардан →</text><text x="280" y="157" text-anchor="middle" fill="${rear}" font-size="16">Муфта</text>
        <path d="M280 93 v25 M275 99 l5 -6 5 6" stroke="#087f87" stroke-width="3" fill="none" transform="rotate(${d.reverse?180:0} 280 105)"/>
      </svg><p>${d.inputs.rearProtection?copy.protection:copy.awd}</p></figure></div>
      <dl class="drivetrain-readouts"><div><dt>Передаточное отношение CVT</dt><dd>${number(d.ratio)}</dd></div><div><dt>Ведомый к ведущему: скорость</dt><dd>${number(1/d.ratio)}×</dd></div><div><dt>Передние колёса Л / П, к средней скорости</dt><dd>${number(d.speeds.FL/(d.speeds.frontCarrier||1))}× / ${number(d.speeds.FR/(d.speeds.frontCarrier||1))}×</dd></div><div><dt>Блокировка гидротрансформатора</dt><dd>${d.inputs.converter==='locked'?'Замкнута':'Разомкнута'}</dd></div></dl>
      <p class="drivetrain-note">${copy.differential}</p>
    </div>`;
  }
  return {render};
})();
