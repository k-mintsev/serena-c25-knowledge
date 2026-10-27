/* Three orthographic cameras over one vehicle. Shapes approximate cast/stamped parts; no OEM dimensions. */
globalThis.SerenaVehicleView = (()=>{
  'use strict';
  const v=(x,y,z)=>({x,y,z}),add=(a,b)=>v(a.x+b.x,a.y+b.y,a.z+b.z),mul=(a,k)=>v(a.x*k,a.y*k,a.z*k);
  const sub=(a,b)=>v(a.x-b.x,a.y-b.y,a.z-b.z),lerp=(a,b,t)=>add(a,mul(sub(b,a),t));
  const unit=a=>mul(a,1/(Math.hypot(a.x,a.y,a.z)||1));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const palette={frame:'#6a7e86',arm:'#577e9e',bush:'#79688b',joint:'#477d7c',spring:'#b16a2f',damper:'#796692',stabilizer:'#527d5d',steering:'#896283',drive:'#526d8f',seal:'#836e5c'};
  const names={front:'Спереди',side:'Сбоку · левая сторона',top:'Сверху · нос вправо'};
  function render(vehicle,options,preview=false){
    const {view,selected,parts,assemblies,isolated,visibility,hiddenParts,reader=false}=options;
    const selectedPart=parts[selected],activeAxle=selectedPart.system,scope=preview?'vehicle':options.scope;
    // Axles share the same screen plane in the front projection; keep only the inspected axle.
    const axleVisible=axle=>axle===activeAxle||(view!=='front'&&visibility.otherAxle);
    const visibleAxles=['front','rear'].filter(axleVisible);
    const assembly=assemblies.find(a=>a.id===selectedPart.assemblyId),related=new Set(assembly?[assembly.root,...assembly.children]:[]);
    const offset=activeAxle==='front'?1.5:-1.5;
    const transform=vehicle.transform;
    const sideCut=view==='side';
    const pose=vehicle.body.pose,cr=Math.cos(pose.roll),sr=Math.sin(pose.roll),cp=Math.cos(pose.pitch),sp=Math.sin(pose.pitch);
    // Undo the shared body rotation before cutting: the plane moves with the vehicle, not the screen.
    const bodyY=p=>p.y*cr+(-p.x*sp+(p.z-pose.heave)*cp)*sr;
    const inside=p=>!sideCut||bodyY(p)>=-1e-9;
    function clipSegment(a,b){
      if(!sideCut)return [a,b];
      const da=bodyY(a),db=bodyY(b),ia=inside(a),ib=inside(b);
      if(!ia&&!ib)return [];
      if(ia&&ib)return [a,b];
      const cut=lerp(a,b,da/(da-db));return ia?[a,cut]:[cut,b];
    }
    function clipPolygon(points){
      if(!sideCut||!points.length)return points;
      const result=[];
      for(let i=0;i<points.length;i++){
        const a=points[(i+points.length-1)%points.length],b=points[i],ia=inside(a),ib=inside(b);
        if(ia!==ib)result.push(lerp(a,b,bodyY(a)/(bodyY(a)-bodyY(b))));
        if(ib)result.push(b);
      }
      return result;
    }
    const baseProject=p=>view==='side'?{x:p.x,y:-p.z}:view==='top'?{x:p.x,y:-p.y}:{x:p.y,y:-p.z};
    let bounds;
    if(scope==='vehicle')bounds=view==='front'?[-1.95,1.95,-2.60,.65]:view==='top'?[-2.8,2.8,-1.9,1.9]:[-2.8,2.8,-2.6,.65];
    else {
      const neutral=SerenaModel.solvePose(activeAxle,{}),p=neutral.wheels.L.points;
      const cross=['a1','a2','g1','b6','c1','c5','e1','f1','f2'].includes(selected);
      let points;
      if(cross)points=[...neutral.frame.mounts.map(m=>m.point),neutral.wheels.L.points.stabMount,neutral.wheels.R.points.stabMount];
      else if(['a3','a4','a5','a6'].includes(selected))points=[p.frameFront,p.frameRear,p.armBall,p.hub];
      else if(['b1','b2','b3','b4','b5'].includes(selected))points=[p.strutTop,p.hub,p.springBottom];
      else if(['c6','d1','d2'].includes(selected))points=[p.steerInner,p.steerOuter,p.hub];
      else if(['d3','d4','d5','d6','g3','g4','f5'].includes(selected))points=[p.cvInner,p.cvOuter,p.hub];
      else if(['e5','e6'].includes(selected))points=[p.springTop,p.springBottom,p.shockTop,p.shockBottom];
      else if(['e2','e3','e4','f6'].includes(selected))points=[p.trailPivot,p.upperInner,p.upperOuter,p.lowerInner,p.hub];
      else if(['c2','f3'].includes(selected))points=[p.stabMount,p.stabEnd,p.stabLinkEnd,p.hub];
      else if(selected==='g2')points=[v(1.16,0,.20),v(1.30,0,.47)];
      else points=[p.hub,p.knuckleTop,p.armBall||p.lowerOuter];
      const projected=points.filter(Boolean).map(baseProject),xs=projected.map(p=>p.x),ys=projected.map(p=>p.y),pad=.30;
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const spanX=Math.max(1.15,maxX-minX+2*pad),spanY=Math.max(1.18,maxY-minY+2*pad);
      bounds=[(minX+maxX-spanX)/2,(minX+maxX+spanX)/2,(minY+maxY-spanY)/2,(minY+maxY+spanY)/2];
    }
    const scale=Math.min(870/(bounds[1]-bounds[0]),455/(bounds[3]-bounds[2]));
    const project=p=>{const q=baseProject(p);return{x:500+(q.x-(bounds[0]+bounds[1])/2)*scale,y:325+(q.y-(bounds[2]+bounds[3])/2)*scale};};
    let minRenderedY=Infinity;
    const xy=p=>{if(sideCut)minRenderedY=Math.min(minRenderedY,bodyY(p));const q=project(p);return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;};
    const line=(a,b,w=5,extra='')=>{const points=clipSegment(a,b);return points.length?`<path d="M${xy(points[0])} L${xy(points[1])}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" ${extra}/>`:'';};
    function path(points,w=5,fill='none',close=false,extra=''){
      if(close){const clipped=clipPolygon(points);return clipped.length?`<path d="M${clipped.map(xy).join(' L')} Z" fill="${fill}" stroke="currentColor" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`:'';}
      let d='';for(let i=1;i<points.length;i++){const clipped=clipSegment(points[i-1],points[i]);if(clipped.length)d+=`M${xy(clipped[0])} L${xy(clipped[1])} `;}
      return d?`<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`:'';
    }
    function circle3(p,a,b,r,w=4,fill='none'){
      return path(Array.from({length:41},(_,i)=>add(p,add(mul(a,r*Math.cos(i*Math.PI/20)),mul(b,r*Math.sin(i*Math.PI/20))))),w,fill,true);
    }
    function ring(p,r=8){if(!inside(p))return '';const q=project(p);return `<circle cx="${q.x}" cy="${q.y}" r="${r}" fill="#f5f9fa" stroke="currentColor" stroke-width="3"/><circle cx="${q.x}" cy="${q.y}" r="${r*.28}" fill="currentColor"/>`;}
    function bushing(p,axis,up,out,r=.065){
      const a=add(p,mul(axis,-.055)),b=add(p,mul(axis,.055));
      return line(a,b,r*scale*1.55)+circle3(a,up,out,r,3,'#eaf0f2')+circle3(b,up,out,r,3,'#eaf0f2')+circle3(b,up,out,r*.48,4,'#75818a')+line(add(a,mul(axis,-.06)),add(b,mul(axis,.06)),3);
    }
    function coil(a,b,turns=7,r=.07,width=4){
      const d=unit(sub(b,a)),u=Math.abs(d.y)>.8?v(1,0,0):unit(v(0,d.z,-d.y));
      const o=v(d.y*u.z-d.z*u.y,d.z*u.x-d.x*u.z,d.x*u.y-d.y*u.x),points=[];
      for(let i=0;i<=turns*16;i++){const t=i/(turns*16),angle=t*turns*Math.PI*2;points.push(add(lerp(a,b,t),add(mul(u,r*Math.cos(angle)),mul(o,r*Math.sin(angle)))));}
      return path(points,width);
    }
    const bellows=(a,b,r=.065)=>line(a,b,Math.max(5,r*scale))+coil(a,b,5,r,3);
    const normal=[],focus=[],mounts=[],context=[],labels=[],anchors={};
    let currentAxle=activeAxle;
    function group(id,content,anchor=null,layer='part',side=null){
      if(sideCut&&side==='R')return;
      if(id&&hiddenParts.has(id))return;
      const active=id===selected;
      if(anchor&&id&&(side!=='R'||!anchors[id]))anchors[id]=anchor;
      const relevant=related.has(id),part=parts[id];
      let opacity=active?1:isolated?(relevant ? .60 : .18):.85;
      if(currentAxle!==activeAxle)opacity*=.55;
      const color=active?'#008e95':palette[part?.kind]||'#637e8c';
      const html=`<g data-layer="${layer}" data-axle="${currentAxle}" ${side?`data-side="${side}"`:''} ${id?`data-part="${id}" role="button" tabindex="${preview?-1:0}" aria-label="№${part.number} ${esc(part.name)}"`:''} opacity="${opacity}" color="${color}" ${active?'data-selected-part="true"':''}><title>${esc(part?.name||'Контекст автомобиля')}</title>${content}</g>`;
      (layer==='mount'?mounts:active?focus:normal).push(html);
    }
    function bodyGroup(layer,content,opacity=.38,axle=null){context.push(`<g data-layer="${layer}" ${axle?`data-axle="${axle}"`:''} color="#637e91" opacity="${opacity}">${content}</g>`);}
    function label(p,text,dx=35,dy=-34,color='#287581'){
      const q=project(p);if(q.x<35||q.x>960||q.y<80||q.y>535)return;
      const width=Math.min(250,Math.max(65,text.length*7.2));
      let x=q.x+dx;if(x+width>975)x=q.x-width-15;if(x<18)x=18;
      let y=Math.max(88,Math.min(520,q.y+dy));
      labels.push(`<g pointer-events="none"><path d="M${q.x} ${q.y} L${x+5} ${y+10}" stroke="${color}" stroke-width="1.2"/><rect x="${x}" y="${y-7}" width="${width}" height="25" rx="6" fill="#f7fbfc" fill-opacity=".95" stroke="#c7dce0"/><text x="${x+8}" y="${y+10}" fill="${color}" font-size="12">${esc(text)}</text></g>`);
    }
    const localLine=(a,b,w=4)=>line(transform(a),transform(b),w);
    const localPath=(pts,w=3,fill='none',close=false)=>path(pts.map(transform),w,fill,close);
    const overviewText=view==='front'?`${activeAxle==='front'?'Передняя':'Задняя'} подвеска · противоположная ось скрыта`:scope==='vehicle'?'Единый автомобиль · обе оси и кузов':'Крупно узел · фрагмент единого автомобиля';
    let background=`<defs><pattern id="grid-${view}-${preview}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0 H0 V40" fill="none" stroke="#cbdce3" stroke-width=".6"/></pattern></defs><rect width="1000" height="600" fill="#f3f7f8"/><rect width="1000" height="600" fill="url(#grid-${view}-${preview})" opacity=".6"/>${reader?'':`<text x="27" y="32" font-size="17" fill="#4f7483">${names[view]}</text><text x="27" y="54" font-size="12" fill="#6d8590">${overviewText}</text>`}`;
    if(view!=='front')background+='<path d="M875 35 H945 L936 28 M945 35 L936 42" fill="none" stroke="#7293a2" stroke-width="2"/><text x="880" y="58" fill="#648392" font-size="12">Вперёд</text>';

    // Exterior shell: translucent panels, glass and wheel openings provide orientation only.
    if(visibility.shell!=='hidden'){
      const opacity=visibility.shell==='outline' ? .26 : .14;
      let shell='';
      const sidePlanes=view==='side'?[vehicle.body.sidePanels[1]]:vehicle.body.sidePanels;
      for(const panel of sidePlanes)shell+=path(panel,2,visibility.shell==='ghost'?'#b2c8d6':'none',true);
      shell+=path(vehicle.body.roof,2,visibility.shell==='ghost'?'#d4e1e8':'none',true);
      const sideY=view==='side'?1.57:1.58;
      const windowShapes=[[[1.57,1.39],[1.00,2.08],[.12,2.08],[.12,1.39]],[[.03,1.39],[.03,2.08],[-1.14,2.08],[-1.14,1.39]],[[-1.24,1.39],[-1.24,2.08],[-2.12,2.08],[-2.18,1.39]]];
      for(const s of view==='side'?[1]:[-1,1])for(const shape of windowShapes)shell+=localPath(shape.map(([x,z])=>v(x,s*sideY,z)),2,visibility.shell==='ghost'?'#87aebf':'none',true);
      for(const x of [.08,-1.20])shell+=localLine(v(x,sideY,.64),v(x,sideY,2.10),1.5);
      shell+=localLine(v(-2.20,sideY,1.18),v(2.15,sideY,1.18),1.5);
      if(view==='front'){
        shell+=localPath([v(2.23,-1.27,1.38),v(1.13,-1.22,2.12),v(1.13,1.22,2.12),v(2.23,1.27,1.38)],2,'#8baab9',true);
        shell+=localLine(v(2.43,-1.45,.81),v(2.43,1.45,.81),4);
        for(const s of [-1,1])shell+=localPath([v(2.42,s*.94,1.04),v(2.42,s*1.35,1.04),v(2.36,s*1.29,1.21),v(2.36,s*.94,1.21)],2,'none',true);
      }
      bodyGroup('body-shell',shell,opacity);
    }
    if(visibility.structure){
      let structure=vehicle.body.rails.map(r=>path(r,11)).join('')+path(vehicle.body.floor,2,'none',true);
      for(const x of [1.84,1.18,-.92,-1.84])structure+=localLine(v(x,-1.25,.56),v(x,1.25,.56),5);
      bodyGroup('body-structure',structure,.32);
      // Upright tower panels connect the top mounts to the body floor and upper reinforcements.
      for(const axle of visibleAxles){
        let towers='';
        for(const side of sideCut?['L']:['L','R']){
          const p=SerenaModel.solvePose(axle,{}).wheels[side].points,s=side==='L'?1:-1;
          const t=axle==='front'?p.strutTop:p.shockTop;
          towers+=localPath([add(t,v(-.16,-s*.10,0)),add(t,v(.16,-s*.10,0)),v(t.x+.2,t.y,.58),v(t.x-.2,t.y,.58)],3,'#cedde4',true);
          const top=axle==='front'?p.strutTop:p.springTop;
          towers+=localLine(add(top,v(0,-s*.16,0)),add(top,v(0,s*.16,0)),8);
          if(axle==='rear')towers+=localLine(p.trailPivot,v(p.trailPivot.x,p.trailPivot.y,.58),10);
        }
        bodyGroup('body-towers',towers,.32,axle);
      }
    }
    if(visibility.mounts){
      for(const axle of visibleAxles){
        let bodyMounts='';
        for(const port of vehicle.body.ports.filter(p=>p.id.startsWith(axle+'.'))){
          if(sideCut&&port.id.endsWith('.R'))continue;
          if(port.kind==='subframe'){
            bodyMounts+=line(port.mount,port.point,7);
            const top=add(port.local,v(0,0,.18));
            bodyMounts+=line(port.point,transform(top),7);
            bodyMounts+=localLine(add(top,v(-.10,0,0)),add(top,v(.10,0,0)),7);
          }else bodyMounts+=ring(port.point,5);
        }
        bodyGroup('body-mounts',bodyMounts,.52,axle);
      }
    }
    // Context housings meet the actual normalized CV inner ports; detailed future systems use the same ports.
    if(visibility.powertrain){
      for(const axle of visibleAxles){
        let casings='';
        const x=axle==='front'?1.52:-1.48;
        const polygon=[v(x-.22,-.24,.13),v(x+.22,-.24,.13),v(x+.22,.24,.13),v(x-.22,.24,.13),v(x-.22,-.24,.13)];
        casings+=localPath(polygon,3,'#ccd8df',true);
        casings+=localLine(v(x,0,.13),v(x,0,.51),12);
        for(const s of [-1,1])casings+=localLine(v(x,0,.3),v(x,s*.24,.3),14);
        bodyGroup('powertrain-context',casings,.36,axle);
      }
    }
    if(visibility.future&&!reader&&axleVisible('front')){
      const envelope=[v(1.10,-.75,.60),v(2.13,-.75,.60),v(2.13,.75,.60),v(1.10,.75,.60)];
      bodyGroup('future-systems',localPath(envelope,2,'none',true).replaceAll('/>',' stroke-dasharray="7 5"/>')+(view==='front'?'':localLine(v(1.3,0,.3),v(-1.48,0,.3),4)),.55,'front');
      label(transform(v(1.62,0,.94)),'Двигатель / CVT · место для модели',15,-35,'#8e6b35');
    }

    for(const axle of [activeAxle==='front'?'rear':'front',activeAxle]){
      if(!axleVisible(axle))continue;
      currentAxle=axle;
      const scene=vehicle.axles[axle],front=axle==='front';
      const contours=[scene.frame.outline,scene.frame.innerOutline].filter(Boolean).map(clipPolygon).filter(points=>points.length).map(points=>`M${points.map(xy).join(' L')} Z`).join(' ');
      group(front?'a1':'e1',`<path d="${contours}" fill="currentColor" fill-rule="evenodd" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>`,scene.frame.mounts[0].point);
      const sides=sideCut?['L']:['R','L'];
      for(const side of sides){
        const w=scene.wheels[side],p=w.points,isL=side==='L',axis=w.axes;
        if(visibility.wheels){
          const wheelCenter=p.hub;
          let tire='';
          if(view==='side'){
            tire=circle3(wheelCenter,axis.forward,axis.up,w.radius,9,'#d6e2e8')+circle3(wheelCenter,axis.forward,axis.up,w.radius*.68,3,'#f6f9fa');
            for(let n=0;n<5;n++){const a=(w.rotation||0)+n*Math.PI*2/5;tire+=line(wheelCenter,add(wheelCenter,add(mul(axis.forward,.24*Math.cos(a)),mul(axis.up,.24*Math.sin(a)))),3);}
          }else{
            const along=view==='top'?axis.forward:axis.up;
            tire=path([add(add(wheelCenter,mul(along,w.radius)),mul(axis.out,w.width/2)),add(add(wheelCenter,mul(along,-w.radius)),mul(axis.out,w.width/2)),add(add(wheelCenter,mul(along,-w.radius)),mul(axis.out,-w.width/2)),add(add(wheelCenter,mul(along,w.radius)),mul(axis.out,-w.width/2))],6,'#d4e1e7',true);
          }
          normal.push(`<g data-layer="wheels" data-axle="${axle}" data-side="${side}" data-wheel="${axle}-${side}" color="#597586" opacity="${axle===activeAxle ? .26 : .14}">${tire}</g>`);
        }
        if(view!=='top'){
          const q=project(v(w.points.hub.x,w.points.hub.y,-.19+(side==='L'?scene.mechanics.roadL:scene.mechanics.roadR)));
          normal.push(`<path data-layer="road" data-axle="${axle}" d="M${q.x-45} ${q.y} H${q.x+45}" stroke="#a8bfc8" stroke-width="5"/>`);
        }
        if(front){
          // C25 photo reference: curved stamped plate, small side lug, no large triangular aperture.
          // The three solved attachment points and the unmeasured kinematics remain unchanged.
          const cross=(a,b)=>v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
          const hingeAxis=unit(sub(p.frameFront,p.frameRear)),outward=unit(sub(p.armBall,lerp(p.frameFront,p.frameRear,.5)));
          const plateNormal=unit(cross(hingeAxis,outward)),bend=add(p.frameFront,mul(outward,.12));
          const curve=t=>add(add(mul(p.frameRear,(1-t)*(1-t)),mul(bend,2*t*(1-t))),mul(p.armBall,t*t));
          const spine=Array.from({length:19},(_,i)=>curve(i/18));
          const edges=spine.map((point,i)=>{
            const t=i/18,tangent=sub(spine[Math.min(i+1,18)],spine[Math.max(0,i-1)]);
            const across=unit(cross(plateNormal,tangent)),width=.045+.026*Math.sin(t*Math.PI);
            return [add(point,mul(across,width)),add(point,mul(across,-width))];
          });
          const outer=[...edges.map(e=>e[0]),...edges.map(e=>e[1]).reverse()];
          const center=mul(add(add(p.frameFront,p.frameRear),p.armBall),1/3);
          const lug=line(p.frameFront,curve(.34),13),rib=path(spine.slice(2,-2),2);
          group('a3',lug+path(outer,4,'currentColor',true)+`<g color="#eff8f9" opacity=".5">${rib}</g>`,center,'part',side);
          group('a4',bushing(p.frameFront,axis.forward,axis.up,axis.out),p.frameFront,'part',side);
          group('a5',bushing(p.frameRear,axis.up,axis.forward,axis.out,.09),p.frameRear,'part',side);
          group('a6',ring(p.armBall,8)+bellows(p.armBall,add(p.armBall,mul(axis.up,.08)),.035),p.armBall,'part',side);
          const knuckle=[p.armBall,add(p.hub,mul(axis.forward,.10)),add(p.strutBottom,mul(axis.forward,.08)),add(p.strutBottom,mul(axis.forward,-.09)),add(p.hub,mul(axis.forward,-.11))];
          group('c3',path(knuckle,7,'currentColor',true)+ring(p.hub,9)+ring(p.armBall,5),p.hub,'part',side);
          group('b2',line(p.strutBottom,lerp(p.strutBottom,p.strutTop,.58),13)+line(lerp(p.strutBottom,p.strutTop,.58),p.strutTop,5),lerp(p.strutBottom,p.strutTop,.40),'part',side);
          group('b1',coil(p.springBottom,p.springTop,7,.115,4),lerp(p.springBottom,p.springTop,.5),'part',side);
          group('b4',bellows(lerp(p.strutBottom,p.strutTop,.60),lerp(p.strutBottom,p.strutTop,.86),.046),lerp(p.strutBottom,p.strutTop,.78),'part',side);
          group('b5',circle3(p.springBottom,axis.forward,axis.out,.145,6),p.springBottom,'part',side);
          group('b3',circle3(p.strutTop,axis.forward,axis.out,.13,6,'#edf4f5')+ring(p.strutTop,7),p.strutTop,'part',side);
          group('d1',line(p.steerInner,lerp(p.steerInner,p.steerOuter,.81),5),lerp(p.steerInner,p.steerOuter,.61),'part',side);
          group('c6',line(lerp(p.steerInner,p.steerOuter,.81),p.steerOuter,9)+ring(p.steerOuter,6),p.steerOuter,'part',side);
          group('d2',bellows(p.steerInner,lerp(p.steerInner,p.steerOuter,.32),.05),lerp(p.steerInner,p.steerOuter,.2),'part',side);
        }else{
          const outer=[p.trailPivot,lerp(p.trailPivot,p.hub,.55),p.lowerOuter,p.hub,p.upperOuter];
          group('e2',path(outer,10,'currentColor',true)+ring(p.trailPivot,7),lerp(p.trailPivot,p.hub,.5),'part',side);
          group('f6',bushing(p.trailPivot,axis.out,axis.forward,axis.up,.085),p.trailPivot,'part',side);
          group('e3',line(p.upperInner,p.upperOuter,9)+ring(p.upperInner,5)+ring(p.upperOuter,5),lerp(p.upperInner,p.upperOuter,.5),'part',side);
          group('e4',line(p.lowerInner,p.lowerOuter,10)+ring(p.lowerInner,5)+ring(p.lowerOuter,5),lerp(p.lowerInner,p.lowerOuter,.5),'part',side);
          group('e5',coil(p.springBottom,p.springTop,7,.125,4)+circle3(p.springBottom,axis.forward,axis.out,.15,5),lerp(p.springBottom,p.springTop,.5),'part',side);
          group('e6',line(p.shockBottom,lerp(p.shockBottom,p.shockTop,.56),12)+line(lerp(p.shockBottom,p.shockTop,.56),p.shockTop,5)+ring(p.shockBottom,5),lerp(p.shockBottom,p.shockTop,.4),'part',side);
        }
        const drive=front?(isL?'d3':null):isL?'f5':null;
        group(drive,line(p.cvBootInner,p.cvBootOuter,8),lerp(p.cvInner,p.cvOuter,.5),'part',side);
        if(front){
          group(isL?'d5':null,line(p.cvInner,p.cvBootInner,16),p.cvInner,'part',side);
          group(isL?'d4':null,line(p.cvBootOuter,p.cvOuter,18),p.cvOuter,'part',side);
          group(isL?'g3':null,bellows(p.cvInner,p.cvBootInner,.065),p.cvBootInner,'part',side);
          group(isL?'d6':null,bellows(p.cvBootOuter,p.cvOuter,.075),p.cvBootOuter,'part',side);
        }else group(null,bellows(p.cvInner,p.cvBootInner,.06)+bellows(p.cvBootOuter,p.cvOuter,.075));
        let hub=circle3(p.hub,axis.forward,axis.up,.105,5,'#edf3f5');
        for(let i=0;i<5;i++)hub+=ring(add(p.hub,add(mul(axis.forward,.075*Math.cos(i*Math.PI*2/5)),mul(axis.up,.075*Math.sin(i*Math.PI*2/5)))),2.5);
        group(front?'c4':'f4',hub,p.hub,'part',side);
        group(front?'b6':'f1',line(p.stabMount,p.stabEnd,7),p.stabEnd,'part',side);
        group(front?'c1':'f2',bushing(p.stabMount,axis.out,axis.forward,axis.up,.055),p.stabMount,'part',side);
        group(front?'c2':'f3',line(p.stabEnd,p.stabLinkEnd,5)+ring(p.stabEnd,5)+ring(p.stabLinkEnd,5),lerp(p.stabEnd,p.stabLinkEnd,.5),'part',side);
        // Mounting ears belong to the structure, not to an independently animated symbol.
        if(visibility.mounts){
          const neutral=SerenaModel.solvePose(axle,{}).wheels[side].points;
          let brackets='';
          const frameAt=q=>transform(v(q.x,side==='L' ? .46 : -.46,.2));
          brackets+=line(p.stabMount,frameAt(neutral.stabMount),7);
          if(front)brackets+=line(p.steerInner,frameAt(neutral.steerInner),6);
          else brackets+=line(p.upperInner,frameAt(neutral.upperInner),7)+line(p.lowerInner,frameAt(neutral.lowerInner),7);
          normal.push(`<g data-layer="assembly-brackets" data-axle="${axle}" color="#78939d" opacity=".42">${brackets}</g>`);
        }
      }
      const lp=scene.wheels.L.points,rp=scene.wheels.R.points;
      group(front?'b6':'f1',line(lp.stabMount,rp.stabMount,7),lerp(lp.stabMount,rp.stabMount,.5));
      if(front){
        group('c5',line(lp.steerInner,rp.steerInner,12),lerp(lp.steerInner,rp.steerInner,.5));
        group('g4',ring(lp.cvInner,10),lp.cvInner);
        const mount=transform(v(1.16,0,.20)),engine=vehicle.body.extensionPorts.find(p=>p.id==='engine-reaction-mount').point;
        group('g2',line(mount,engine,10)+ring(mount,8)+ring(engine,9),engine);
      }
      for(const m of scene.frame.mounts){
        if(sideCut&&m.side==='R')continue;
        const id=front?(m.position==='front'?'g1':'a2'):'e1';
        group(id,ring(m.point,front?10:7),m.point,'mount',m.side);
        if(front&&view==='top'&&['a1','a2','g1'].includes(selected))label(m.point,`${m.position==='front'?'Передняя':'Задняя'} ${m.side==='L'?'Л':'П'} · №${parts[id].number}`,m.position==='front'?20:-145,m.side==='L'?-38:33);
      }
    }
    // A few explicit attachments on the near side explain the complete load path.
    if(!preview&&visibility.mounts&&scope==='assembly'){
      const p=vehicle.axles[activeAxle].wheels.L.points;
      if(['a3','a4','a5','a6'].includes(selected)&&view==='top'){
        label(p.frameFront,'№4 → подрамник',15,-42);
        label(p.frameRear,'№5 → подрамник',-145,-80);
        label(p.armBall,'№6 → кулак',30,20);
      }
      if(['b1','b2','b3','b4','b5'].includes(selected)&&view!=='top')label(p.strutTop,'Опора → башня кузова',-190,-38);
      if(['e2','f6'].includes(selected))label(p.trailPivot,'Сайлентблок → кронштейн кузова',20,-48);
    }
    const anchor=anchors[selected];
    let focusLabel='';
    if(anchor&&!hiddenParts.has(selected)){
      const q=project(anchor);
      focusLabel=`<g pointer-events="none"><circle cx="${q.x}" cy="${q.y}" r="17" fill="none" stroke="#008e95" stroke-width="1.3" stroke-dasharray="4 4"/><rect x="${q.x+20}" y="${q.y-33}" width="44" height="25" rx="7" fill="#008e95"/><text x="${q.x+42}" y="${q.y-16}" text-anchor="middle" fill="white" font-size="13" font-weight="700">№${selectedPart.number}</text></g>`;
    }
    const footer=reader?'':`<text x="28" y="574" font-size="12" fill="#64808d">${scope==='vehicle'?'Кузов, оси и опорные точки — одна сцена':'Крепления показаны в общей системе кузова'} · форма приблизительная, размеры не измерены</text>`;
    return `<svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" aria-label="${names[view]}: ${esc(selectedPart.name)}" data-view-scene="${view}" data-half="${sideCut?'left':'full'}" ${sideCut?`data-min-rendered-y="${minRenderedY}"`:''} data-scene-time="${vehicle.time}" data-vehicle-id="${vehicle.id}" data-mount-count="${vehicle.axles[activeAxle].frame.mounts.length}" data-scope="${scope}">${background}${context.join('')}${normal.join('')}${focus.join('')}${mounts.join('')}${labels.join('')}${focusLabel}${footer}</svg>`;
  }
  return {render};
})();
