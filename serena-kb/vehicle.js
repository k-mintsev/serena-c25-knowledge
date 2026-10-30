/* Whole-vehicle owner: a single rigid body, four unsprung corners and shared attachment ports.
 * All geometry, forces, masses and time are educational and normalized, not Nissan measurements.
 * Existing axle constraints remain in serena-kb-model.js. No independent camera-specific motion.
 */
(function(root,factory){
  const base=typeof module==='object'&&module.exports?require('./serena-kb-model.js'):root.SerenaModel;
  const drive=typeof module==='object'&&module.exports?require('./serena-kb-drivetrain.js'):root.SerenaDrivetrain;
  const api=factory(base,drive);Object.assign(base,api);
  if(typeof module==='object'&&module.exports)module.exports=base;
})(typeof globalThis!=='undefined'?globalThis:this,function(base,drive){
  'use strict';
  const V=(x,y,z)=>({x,y,z}),add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const finite=(x,d=0)=>Number.isFinite(x)?x:d;
  const corners=[{id:'FL',axle:'front',side:'L',x:1.5,y:1.42},{id:'FR',axle:'front',side:'R',x:1.5,y:-1.42},
                 {id:'RL',axle:'rear',side:'L',x:-1.5,y:1.42},{id:'RR',axle:'rear',side:'R',x:-1.5,y:-1.42}];
  function bodyTransform(p,body,direction=false){
    const cr=Math.cos(body.roll),sr=Math.sin(body.roll),cp=Math.cos(body.pitch),sp=Math.sin(body.pitch);
    // R_y(-pitch) R_x(roll); positive pitch lifts the front axle.
    const z=p.y*sr+p.z*cr,r=V(p.x*cp-z*sp,p.y*cr-p.z*sr,p.x*sp+z*cp);
    return direction?r:add(r,V(0,0,body.heave));
  }
  function transformAxle(scene,body){
    const point=p=>p?bodyTransform(p,body):null;
    for(const side of ['L','R']){
      const w=scene.wheels[side];
      w.points=Object.fromEntries(Object.entries(w.points).map(([k,p])=>[k,point(p)]));
      w.axes=Object.fromEntries(Object.entries(w.axes).map(([k,p])=>[k,bodyTransform(p,body,true)]));
    }
    scene.points=Object.fromEntries(Object.entries(scene.points).map(([k,p])=>[k,point(p)]));
    scene.links=scene.links.map(l=>({...l,a:point(l.a),b:point(l.b),points:l.points.map(point)}));
    scene.frame.mounts=scene.frame.mounts.map(m=>({...m,point:point(m.point)}));
    scene.frame.outline=scene.frame.outline.map(point);
    if(scene.frame.innerOutline)scene.frame.innerOutline=scene.frame.innerOutline.map(point);
    return scene;
  }
  // This one-box silhouette communicates position and attachment, not an exterior scan.
  const sideProfile=[[2.43,.55],[2.45,.98],[2.20,1.26],[1.77,1.39],[1.12,2.12],[.78,2.26],
    [-2.10,2.26],[-2.39,2.10],[-2.48,.56],[2.43,.55]];
  function bodyGeometry(body,axles){
    const point=p=>bodyTransform(p,body),ports=[];
    const port=(id,partId,local,mount,kind)=>ports.push({id,partId,local,point:point(local),mount,kind});
    for(const [axle,scene] of Object.entries(axles)){
      const offset=axle==='front'?1.5:-1.5;
      const neutral=base.solvePose(axle,{});
      for(const m of neutral.frame.mounts){
        const p=m.point;
        port(`${axle}.frame.${m.position}.${m.side}`,axle==='front'?(m.position==='front'?'g1':'a2'):'e1',V(p.x,p.y,p.z+.18),scene.frame.mounts.find(x=>x.side===m.side&&x.position===m.position).point,'subframe');
      }
      for(const side of ['L','R']){
        const p=neutral.wheels[side].points,wp=scene.wheels[side].points;
        if(axle==='front')port(`${axle}.strut.${side}`,'b3',p.strutTop,wp.strutTop,'strut-tower');
        else{
          port(`rear.spring.${side}`,'e5',p.springTop,wp.springTop,'spring-seat');
          port(`rear.shock.${side}`,'e6',p.shockTop,wp.shockTop,'shock-tower');
          port(`rear.trailing.${side}`,'f6',p.trailPivot,wp.trailPivot,'trailing-clevis');
        }
      }
    }
    const extensionPorts=[
      {id:'front-transmission-output-L',node:'cvt',point:axles.front.wheels.L.points.cvInner,status:'normalized-context'},
      {id:'rear-differential-output-L',node:'driveline',point:axles.rear.wheels.L.points.cvInner,status:'normalized-context'},
      {id:'engine-reaction-mount',node:'engine',point:point(V(1.30,0,.47)),status:'reserved'}];
    const rails=[-1,1].map(s=>[V(-2.20,s*.46,.56),V(2.12,s*.46,.56)].map(point));
    return {pose:{...body},ports,extensionPorts,rails,
      sidePanels:[-1,1].map(s=>sideProfile.map(([x,z])=>point(V(x,s*1.57,z)))),
      roof:[V(1.12,-1.42,2.20),V(1.12,1.42,2.20),V(-2.12,1.45,2.23),V(-2.12,-1.45,2.23)].map(point),
      floor:[V(2.10,-1.38,.59),V(2.10,1.38,.59),V(-2.30,1.38,.59),V(-2.30,-1.38,.59)].map(point),
      shellConfidence:'approximate-one-box-shape',measuredDimensions:null};
  }
  function VehicleSimulation(options={}){this.params={spring:1,damping:1,antiroll:1};this.drivetrain=new drive.Drivetrain(options.drivetrain);this.setParameters(options);this.reset();}
  VehicleSimulation.prototype.setParameters=base.Simulation.prototype.setParameters;
  VehicleSimulation.prototype.reset=function(){
    this.drivetrain.reset();
    this.body={heave:0,roll:0,pitch:0,v:0,vr:0,vp:0};
    this.corners=Object.fromEntries(corners.map(c=>[c.id,{zu:0,vu:0,forces:{spring:0,damper:0,antiroll:0,bumpStop:0,tire:0,body:0}}]));
    this.time=0;this.drivePhase=0;this.inputs={roadFL:0,roadFR:0,roadRL:0,roadRR:0,rack:0,drive:0};return this;
  };
  VehicleSimulation.prototype.step=function(dt,inputs={}){
    this.setParameters(inputs);
    const i=this.inputs={roadFL:clamp(finite(inputs.roadFL,finite(inputs.roadL)), -.18,.18),roadFR:clamp(finite(inputs.roadFR,finite(inputs.roadR)),-.18,.18),
      roadRL:clamp(finite(inputs.roadRL),-.18,.18),roadRR:clamp(finite(inputs.roadRR),-.18,.18),rack:clamp(finite(inputs.rack),-.18,.18),drive:finite(inputs.drive)};
    dt=clamp(finite(dt),0,.25);const count=Math.max(1,Math.ceil(dt*480)),h=dt/count;
    for(let n=0;n<count;n++){
      const b=this.body,q={},qv={};
      for(const c of corners){const w=this.corners[c.id];q[c.id]=w.zu-(b.heave+c.x*b.pitch+c.y*b.roll);qv[c.id]=w.vu-(b.v+c.x*b.vp+c.y*b.vr);}
      let total=0,rollMoment=0,pitchMoment=0;
      for(const c of corners){
        const w=this.corners[c.id],other=c.id[0]+(c.side==='L'?'R':'L');
        const spring=18*this.params.spring*q[c.id],damper=2.8*this.params.damping*qv[c.id];
        const antiroll=7*this.params.antiroll*(q[c.id]-q[other]);
        const bumpStop=220*Math.sign(q[c.id])*Math.pow(Math.max(0,Math.abs(q[c.id])-.16),1.5);
        const force=spring+damper+antiroll+bumpStop,tire=-160*(w.zu-i['road'+c.id])-.45*w.vu;
        w.forces={spring,damper,antiroll,bumpStop,tire,body:force};
        total+=force;rollMoment+=c.y*force;pitchMoment+=c.x*force;
      }
      // One rigid sprung mass: simultaneous forces drive heave, pitch and roll.
      b.v+=h*total/4;b.vr+=h*rollMoment/8.0656;b.vp+=h*pitchMoment/9;
      b.heave+=h*b.v;b.roll+=h*b.vr;b.pitch+=h*b.vp;
      for(const c of corners){const w=this.corners[c.id];w.vu+=h*(w.forces.tire-w.forces.body)/.12;w.zu+=h*w.vu;}
      this.time+=h;this.drivePhase+=h*i.drive;
    }
    const front=base.solvePose('front',{rack:i.rack});
    this.drivetrain.step(dt,inputs,{left:front.wheels.L.steer,right:front.wheels.R.steer});
    return this;
  };
  VehicleSimulation.prototype.snapshot=function(){
    const b=this.body,axles={},drivetrain=this.drivetrain.snapshot();
    for(const axle of ['front','rear']){
      const prefix=axle==='front'?'F':'R',x=axle==='front'?1.5:-1.5;
      const values={};
      for(const side of ['L','R']){
        const c=corners.find(c=>c.id===prefix+side),w=this.corners[c.id];
        values['travel'+side]=w.zu-(b.heave+x*b.pitch+c.y*b.roll);
      }
      const scene=transformAxle(base.solvePose(axle,{...values,rack:this.inputs.rack,drive:this.drivePhase}),b);
      scene.time=this.time;scene.mechanics.parameters={...this.params};
      scene.mechanics.roadL=this.inputs['road'+prefix+'L'];scene.mechanics.roadR=this.inputs['road'+prefix+'R'];
      for(const side of ['L','R']){
        const c=corners.find(c=>c.id===prefix+side),w=this.corners[c.id],out=scene.wheels[side];
        out.compression=values['travel'+side];out.velocity=w.vu-(b.v+x*b.vp+c.y*b.vr);
        out.bodyVelocity=b.v+x*b.vp+c.y*b.vr;out.forces={...w.forces};out.rotation=drivetrain.phases[prefix+side];
      }
      axles[axle]=scene;
    }
    const midpoint=(a,b)=>V((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
    drivetrain.geometry={primary:bodyTransform(V(1.85,.32,.65),b),secondary:bodyTransform(V(1.23,.32,.65),b),
      frontDifferential:midpoint(axles.front.wheels.L.points.cvInner,axles.front.wheels.R.points.cvInner),
      rearDifferential:midpoint(axles.rear.wheels.L.points.cvInner,axles.rear.wheels.R.points.cvInner),
      frontOutputs:['L','R'].map(s=>axles.front.wheels[s].points.cvInner),rearOutputs:['L','R'].map(s=>axles.rear.wheels[s].points.cvInner)};
    return {id:'serena-nc25-whole-vehicle',units:'normalized',time:this.time,axles,drivetrain,body:bodyGeometry(b,axles),
      nodes:[{id:'body',parent:null},{id:'front',parent:'body'},{id:'rear',parent:'body'},{id:'engine',parent:'body',status:'context'},{id:'cvt',parent:'engine',status:'functional-principle'},{id:'driveline',parent:'body',status:'functional-principle'}],
      solver:{ok:axles.front.solver.ok&&axles.rear.solver.ok,maxError:Math.max(axles.front.solver.maxError,axles.rear.solver.maxError)},
      transform:p=>bodyTransform(p,b)};
  };
  function vehicleSelfTest(){
    const sim=new VehicleSimulation(),neutral=sim.snapshot(),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
    const invariant=dist(neutral.axles.front.frame.mounts[0].point,neutral.axles.rear.frame.mounts[0].point);
    let maxMountError=0,maxBodyDistanceError=0,finiteState=true;
    for(let n=0;n<800;n++){
      sim.step(1/120,{roadFL:.10*Math.sin(n/35),roadFR:.04*Math.sin(n/45),roadRL:.08*Math.sin((n-50)/35),roadRR:.02*Math.sin((n-50)/45),rack:.08*Math.sin(n/50)});
      if(n%20===0){const s=sim.snapshot();
        maxBodyDistanceError=Math.max(maxBodyDistanceError,Math.abs(dist(s.axles.front.frame.mounts[0].point,s.axles.rear.frame.mounts[0].point)-invariant));
        for(const p of s.body.ports)if(p.kind!=='subframe')maxMountError=Math.max(maxMountError,dist(p.point,p.mount));
        finiteState=finiteState&&Object.values(sim.body).every(Number.isFinite)&&s.solver.ok;
      }
    }
    const left=new VehicleSimulation();left.step(.15,{roadFL:.13});const snapshot=left.snapshot();
    const sharedBody=dist(snapshot.axles.front.frame.mounts[0].point,snapshot.axles.rear.frame.mounts[0].point);
    return {pass:finiteState&&maxMountError<1e-8&&maxBodyDistanceError<1e-8&&Math.abs(sharedBody-invariant)<1e-8,
      maxMountError,maxBodyDistanceError,wheels:4,bodyNodes:1,extensionPorts:neutral.body.extensionPorts.length};
  }
  return {VehicleSimulation,vehicleSelfTest};
});
