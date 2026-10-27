/* Serena NC25 educational mechanism, normalized lengths/time/mass, not measured Nissan data.
 * Coordinates: x forward, y vehicle-left, z up. One 3D state is projected into 2D.
 * Topology: OEM NC25-002639 sections 401/431/492/391 at nissan.epc-data.com;
 * https://www.mathworks.com/help/vdynblks/ref/steeringsystem.html
 * https://www.mathworks.com/help/sm/ug/independent-suspension-system-templates.html
 * Rear trailing-arm front rubber mounting is idealized as a spherical joint.
 * Dynamics is a normalized coupled quarter-car illustration, not a load prediction.
 * CommonJS: require('./serena-kb-model.js'); browser: window.SerenaModel.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SerenaModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var EPS = 1e-10;
  function v(x, y, z) { return {x:x, y:y, z:z}; }
  function add(a,b) { return v(a.x+b.x,a.y+b.y,a.z+b.z); }
  function sub(a,b) { return v(a.x-b.x,a.y-b.y,a.z-b.z); }
  function mul(a,k) { return v(a.x*k,a.y*k,a.z*k); }
  function dot(a,b) { return a.x*b.x+a.y*b.y+a.z*b.z; }
  function cross(a,b) { return v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x); }
  function length(a) { return Math.sqrt(dot(a,a)); }
  function distance(a,b) { return length(sub(a,b)); }
  function unit(a) { var n=length(a); return n>EPS?mul(a,1/n):v(0,0,1); }
  function clamp(x,a,b) { return Math.max(a,Math.min(b,x)); }
  function finite(x,d) { return typeof x==='number' && Number.isFinite(x)?x:d; }
  function rotate(a,axis,t) {
    var c=Math.cos(t),s=Math.sin(t);
    return add(add(mul(a,c),mul(cross(axis,a),s)),mul(axis,dot(axis,a)*(1-c)));
  }
  function rx(a,t) { return rotate(a,v(1,0,0),t); }
  function euler(a,q) { return rx(rotate(rotate(a,v(0,0,1),q[2]),v(0,1,0),q[1]),q[0]); }
  function norm(a) { return Math.sqrt(a.reduce(function(s,x){return s+x*x;},0)); }
  function linearSolve(a,b) {
    var n=b.length,m=a.map(function(row,i){return row.slice().concat([b[i]]);});
    for(var k=0;k<n;k++) {
      var p=k;
      for(var i=k+1;i<n;i++) if(Math.abs(m[i][k])>Math.abs(m[p][k])) p=i;
      if(Math.abs(m[p][k])<1e-12) return null;
      var row=m[k];m[k]=m[p];m[p]=row;
      var d=m[k][k];for(var j=k;j<=n;j++) m[k][j]/=d;
      for(i=0;i<n;i++) if(i!==k) {
        var f=m[i][k];for(j=k;j<=n;j++)m[i][j]-=f*m[k][j];
      }
    }
    return m.map(function(r){return r[n];});
  }
  function newton(fn,initial) {
    var x=initial.slice(),r=fn(x),it=0;
    if(!r || !Number.isFinite(norm(r))) return {ok:false,x:x,error:Infinity,iterations:0};
    for(;it<26 && norm(r)>2e-10;it++) {
      var h=1e-6,jac=r.map(function(){return [];});
      for(var j=0;j<x.length;j++) {
        var xp=x.slice();xp[j]+=h;var rp=fn(xp);
        if(!rp) return {ok:false,x:x,error:norm(r),iterations:it};
        for(var i=0;i<r.length;i++)jac[i][j]=(rp[i]-r[i])/h;
      }
      var dx=linearSolve(jac,r.map(function(z){return -z;}));
      if(!dx) break;
      var accepted=false;
      for(var scale=1;scale>=1/128;scale/=2) {
        var trial=x.map(function(z,k){return z+clamp(dx[k]*scale,-0.25,0.25);});
        var rt=fn(trial);
        if(rt && Number.isFinite(norm(rt)) && norm(rt)<norm(r)) {
          x=trial;r=rt;accepted=true;break;
        }
      }
      if(!accepted) break;
    }
    return {ok:norm(r)<2e-8,x:x,error:norm(r),iterations:it};
  }

  var FRONT={A:v(0,0.46,0.20),B:v(0,1.24,0.05),T:v(0,0.98,1.50),
    d:v(0,-0.04,0.29),c:v(0,0.18,0.13),j:v(-0.35,-0.10,0.17),I:v(-0.35,0.37,0.24)};
  FRONT.e=unit(sub(FRONT.T,add(FRONT.B,FRONT.d)));
  FRONT.strut0=distance(FRONT.T,add(FRONT.B,FRONT.d));
  FRONT.armLength=distance(FRONT.A,FRONT.B);
  FRONT.tieLength=distance(add(FRONT.B,FRONT.j),FRONT.I);
  var REAR={P:v(0.65,1.20,0.12),c:v(-0.65,0.15,0.08),
    u:v(-0.62,0.08,0.34),l:v(-0.68,0.09,-0.04),U:v(0.06,0.56,0.46),L:v(-0.08,0.52,0.08)};
  REAR.upperLength=distance(add(REAR.P,REAR.u),REAR.U);
  REAR.lowerLength=distance(add(REAR.P,REAR.l),REAR.L);

  function frontState(theta,psi,rack) {
    var g=FRONT,B=add(g.A,rx(sub(g.B,g.A),theta)),r=sub(g.T,B);
    var ds=dot(g.d,g.e),disc=ds*ds+dot(r,r)-dot(g.d,g.d);
    if(disc<=0)return null;
    var s=-ds+Math.sqrt(disc),local=add(g.d,mul(g.e,s));
    var phi=Math.atan2(r.z,r.y)-Math.atan2(local.z,local.y),axis=unit(r);
    function R(a){return rotate(rx(a,phi),axis,psi);}
    return {B:B,U:add(B,R(g.d)),C:add(B,R(g.c)),J:add(B,R(g.j)),I:add(g.I,v(0,rack,0)),
      R:R,s:s,theta:theta,psi:psi,phi:phi};
  }
  function frontSolve(q,rack) {
    var n=Math.max(1,Math.ceil(Math.max(Math.abs(q),Math.abs(rack))/0.025)),x=[0,0],result;
    for(var k=1;k<=n;k++) {
      var target=q*k/n,rr=rack*k/n;
      result=newton(function(a){
        var st=frontState(a[0],a[1],rr);
        return st?[st.C.z-(FRONT.B.z+FRONT.c.z+target),distance(st.J,st.I)-FRONT.tieLength]:null;
      },x);
      if(!result.ok)break;
      x=result.x;
    }
    var appliedQ=result.ok?q:q*(k-1)/n,appliedRack=result.ok?rack:rack*(k-1)/n;
    var st=frontState(x[0],x[1],appliedRack);
    st.solver={ok:result.ok,error:result.error,iterations:result.iterations,
      requestedTravel:q,appliedTravel:appliedQ,requestedRack:rack,appliedRack:appliedRack};
    return st;
  }
  function rearState(q) {
    function R(a){return euler(a,q);}
    return {C:add(REAR.P,R(REAR.c)),U:add(REAR.P,R(REAR.u)),L:add(REAR.P,R(REAR.l)),R:R};
  }
  function rearSolve(q) {
    var n=Math.max(1,Math.ceil(Math.abs(q)/0.025)),x=[0,0,0],result;
    for(var k=1;k<=n;k++) {
      var target=q*k/n;
      result=newton(function(a){
        var st=rearState(a);
        return [distance(st.U,REAR.U)-REAR.upperLength,distance(st.L,REAR.L)-REAR.lowerLength,
          st.C.z-(REAR.P.z+REAR.c.z+target)];
      },x);
      if(!result.ok)break;
      x=result.x;
    }
    var st=rearState(x);
    st.solver={ok:result.ok,error:result.error,iterations:result.iterations,
      requestedTravel:q,appliedTravel:result.ok?q:q*(k-1)/n};
    return st;
  }

  var POINT_NAMES=['frameFront','frameRear','armBall','strutTop','strutBottom','hub','steerInner','steerOuter',
    'cvInner','cvOuter','springTop','springBottom','shockTop','shockBottom','trailPivot','upperInner','upperOuter',
    'lowerInner','lowerOuter','stabMount','stabEnd','stabLinkEnd'];
  var COMPONENTS={arm:'front-lower-arm',armFrontBush:'front-arm-front-bush',armRearBush:'front-arm-rear-bush',
    ball:'front-ball-joint',strut:'front-strut',spring:'coil-spring',damper:'shock-absorber',
    steering:'steering-rack',tieRod:'inner-tie-rod',tieEnd:'outer-tie-rod-end',
    cv:'driveshaft',stabilizer:'anti-roll-bar',dropLink:'stabilizer-link',
    trailing:'rear-trailing-arm',upperLink:'rear-upper-link',lowerLink:'rear-lower-link'};
  function dropLink(attachment,axle) {
    var H=v(-0.25,0.90,0.20),lever=axle==='front'?0.30:0.45;
    var at0=axle==='front'?add(FRONT.B,v(0,-0.02,0.65)):add(REAR.P,v(-0.60,-0.04,0.43));
    var l=distance(add(H,v(lever,0,0)),at0),d=sub(attachment,H),rad=Math.hypot(d.x,d.z);
    var cs=(dot(d,d)+lever*lever-l*l)/(2*lever*rad),ok=Number.isFinite(cs)&&Math.abs(cs)<=1+1e-8;
    var a=Math.atan2(d.z,d.x)-Math.acos(clamp(cs,-1,1));
    // At the static pose this continuous branch is zero (both attachments are above the bar).
    var K=add(H,v(lever*Math.cos(a),0,lever*Math.sin(a)));
    return {mount:H,end:K,attachment:attachment,angle:a,length:l,error:Math.abs(distance(K,attachment)-l),ok:ok};
  }
  function corner(axle,side,travel,rack,transform) {
    var sign=side==='L'?1:-1,st=axle==='front'?frontSolve(travel,sign*rack):rearSolve(travel);
    var p={};POINT_NAMES.forEach(function(n){p[n]=null;});
    var C=st.C,out=st.R(v(0,1,0));
    if(axle==='front') {
      p.frameFront=v(0.28,0.46,0.20);p.frameRear=v(-0.28,0.46,0.20);
      p.armBall=st.B;p.strutTop=FRONT.T;p.strutBottom=st.U;p.hub=C;
      p.steerInner=st.I;p.steerOuter=st.J;
      var axis=unit(sub(FRONT.T,st.U));
      p.springTop=sub(FRONT.T,mul(axis,0.15));p.springBottom=add(st.U,mul(axis,0.35));
      p.shockTop=FRONT.T;p.shockBottom=st.U;
      p.stabLinkEnd=add(st.B,st.R(v(0,-0.02,0.65)));
      p.cvInner=v(0.02,0.24,0.30);
    } else {
      p.frameFront=v(0.34,0.46,0.23);p.frameRear=v(-0.34,0.46,0.23);
      p.hub=C;p.trailPivot=REAR.P;p.upperInner=REAR.U;p.upperOuter=st.U;
      p.lowerInner=REAR.L;p.lowerOuter=st.L;
      p.springTop=v(0.10,1.05,1.12);p.springBottom=add(REAR.P,st.R(v(-0.53,-0.12,0.05)));
      p.shockTop=v(0.10,1.25,1.18);p.shockBottom=add(REAR.P,st.R(v(-0.65,0.20,0.11)));
      p.stabLinkEnd=add(REAR.P,st.R(v(-0.60,-0.04,0.43)));
      p.cvInner=v(0.02,0.24,0.30);
    }
    p.cvOuter=sub(C,mul(out,0.12));
    var bar=dropLink(p.stabLinkEnd,axle);p.stabMount=bar.mount;p.stabEnd=bar.end;
    var cvAxis=unit(sub(p.cvOuter,p.cvInner));
    var neutralCenter=axle==='front'?add(FRONT.B,FRONT.c):add(REAR.P,REAR.c);
    var neutralCVLength=distance(v(0.02,0.24,0.30),sub(neutralCenter,v(0,0.12,0)));
    p.cvBootInner=add(p.cvInner,mul(sub(p.cvOuter,p.cvInner),0.16));
    p.cvBootOuter=add(p.cvInner,mul(sub(p.cvOuter,p.cvInner),0.86));
    p.knuckleTop=axle==='front'?st.U:st.U;p.armCenter=axle==='front'?FRONT.A:null;
    var localPoints=p;
    function world(a){return transform(v(a.x,sign*a.y,a.z));}
    var wp={};Object.keys(p).forEach(function(n){wp[n]=p[n]?world(p[n]):null;});
    function worldAxis(a){return transform(v(a.x,sign*a.y,a.z),true);}
    var axes={up:worldAxis(st.R(v(0,0,1))),out:worldAxis(out),forward:worldAxis(st.R(v(1,0,0)))};
    var forward=st.R(v(1,0,0));
    return {side:side,points:wp,axes:axes,solver:st.solver,localPoints:localPoints,
      radius:0.37,width:0.19,travel:st.solver.appliedTravel,requestedTravel:travel,
      steer:Math.atan2(sign*forward.y,forward.x),camber:Math.asin(clamp(out.z,-1,1)),
      strutLength:axle==='front'?st.s:null,springLength:distance(p.springTop,p.springBottom),
      shockLength:distance(p.shockTop,p.shockBottom),
      cv:{outerAngle:Math.acos(clamp(dot(cvAxis,out),-1,1)),
        innerAngle:Math.acos(clamp(dot(cvAxis,v(0,1,0)),-1,1)),length:distance(p.cvInner,p.cvOuter),
        plunge:distance(p.cvInner,p.cvOuter)-neutralCVLength},
      antiroll:{angle:bar.angle,linkError:bar.error,ok:bar.ok},
      constraints:axle==='front'?{
        armError:Math.abs(distance(st.B,FRONT.A)-FRONT.armLength),
        tieError:Math.abs(distance(st.J,st.I)-FRONT.tieLength),
        strutError:distance(FRONT.T,add(st.U,mul(st.R(FRONT.e),st.s)))}:{
        upperLinkError:Math.abs(distance(st.U,REAR.U)-REAR.upperLength),
        lowerLinkError:Math.abs(distance(st.L,REAR.L)-REAR.lowerLength),
        trailingError:Math.abs(distance(st.C,REAR.P)-length(REAR.c))}};
  }
  function solvePose(axle,inputs) {
    axle=axle==='rear'?'rear':'front';inputs=inputs||{};
    var qL=clamp(finite(inputs.travelL,0),-0.22,0.22),qR=clamp(finite(inputs.travelR,0),-0.22,0.22);
    var rack=clamp(finite(inputs.rack,0),-0.18,0.18),bl=finite(inputs.bodyL,0),br=finite(inputs.bodyR,0);
    var heave=(bl+br)/2,roll=Math.atan2(bl-br,2.84),offset=axle==='front'?1.5:-1.5;
    function transform(p,direction){var r=rx(p,roll);return direction?r:add(r,v(offset,0,heave));}
    var wheels={L:corner(axle,'L',qL,rack,transform),R:corner(axle,'R',qR,rack,transform)};
    var points={},links=[];
    function link(id,a,b,component) {
      if(a&&b)links.push({id:id,componentId:component,a:a,b:b,points:[a,b]});
    }
    ['L','R'].forEach(function(s){
      var w=wheels[s],p=w.points;Object.keys(p).forEach(function(n){points[s+'.'+n]=p[n];});
      if(axle==='front') {
        link(s+'.arm.front',p.frameFront,p.armBall,COMPONENTS.arm);
        link(s+'.arm.rear',p.frameRear,p.armBall,COMPONENTS.arm);
        link(s+'.strut',p.strutBottom,p.strutTop,COMPONENTS.strut);
        link(s+'.tie',p.steerInner,p.steerOuter,COMPONENTS.tieRod);
      }else{
        link(s+'.trailing',p.trailPivot,p.hub,COMPONENTS.trailing);
        link(s+'.upper',p.upperInner,p.upperOuter,COMPONENTS.upperLink);
        link(s+'.lower',p.lowerInner,p.lowerOuter,COMPONENTS.lowerLink);
      }
      link(s+'.spring',p.springBottom,p.springTop,COMPONENTS.spring);
      link(s+'.damper',p.shockBottom,p.shockTop,COMPONENTS.damper);
      link(s+'.drive',p.cvInner,p.cvOuter,COMPONENTS.cv);
      link(s+'.stab.arm',p.stabMount,p.stabEnd,COMPONENTS.stabilizer);
      link(s+'.stab.link',p.stabEnd,p.stabLinkEnd,COMPONENTS.dropLink);
    });
    link('stabilizer.cross',wheels.L.points.stabMount,wheels.R.points.stabMount,COMPONENTS.stabilizer);
    if(axle==='front')link('rack',wheels.L.points.steerInner,wheels.R.points.steerInner,COMPONENTS.steering);
    var mounts=[];
    ['front','rear'].forEach(function(pos){['L','R'].forEach(function(s){
      mounts.push({position:pos,side:s,point:transform(v(pos==='front'?0.34:-0.34,s==='L'?0.46:-0.46,0.20))});
    });});
    // Approximate stamped frame silhouette from NC25 OEM 401B_002, not an OEM measurement.
    // Four cylindrical mount hardpoints and all solver geometry remain independent of this contour.
    var outlineShape=axle==='front'?[
      [0.30,0],[0.30,0.14],[0.34,0.28],[0.42,0.39],[0.45,0.47],[0.43,0.53],
      [0.37,0.57],[0.30,0.56],[0.22,0.51],[0.15,0.44],[0.04,0.40],[-0.10,0.42],
      [-0.24,0.51],[-0.32,0.56],[-0.39,0.55],[-0.44,0.49],[-0.44,0.42],[-0.39,0.35],
      [-0.33,0.26],[-0.29,0.13],[-0.28,0],[-0.29,-0.13],[-0.33,-0.26],[-0.39,-0.35],
      [-0.44,-0.42],[-0.44,-0.49],[-0.39,-0.55],[-0.32,-0.56],[-0.24,-0.51],[-0.10,-0.42],
      [0.04,-0.40],[0.15,-0.44],[0.22,-0.51],[0.30,-0.56],[0.37,-0.57],[0.43,-0.53],
      [0.45,-0.47],[0.42,-0.39],[0.34,-0.28],[0.30,-0.14],[0.30,0]
    ]:[[0.34,0.46],[-0.34,0.46],[-0.34,-0.46],[0.34,-0.46],[0.34,0.46]];
    var outline=outlineShape.map(function(p){return transform(v(p[0],p[1],0.20));});
    // Opposite winding permits one SVG compound path with an open central aperture.
    var innerOutline=axle==='front'?[
      [0.20,0],[0.20,-0.13],[0.24,-0.25],[0.23,-0.32],[0.17,-0.35],[0.06,-0.32],
      [-0.07,-0.34],[-0.17,-0.34],[-0.23,-0.28],[-0.21,-0.16],[-0.20,0],
      [-0.21,0.16],[-0.23,0.28],[-0.17,0.34],[-0.07,0.34],[0.06,0.32],
      [0.17,0.35],[0.23,0.32],[0.24,0.25],[0.20,0.13],[0.20,0]
    ].map(function(p){return transform(v(p[0],p[1],0.20));}):null;
    var allOK=['L','R'].every(function(s){return wheels[s].solver.ok&&wheels[s].antiroll.ok;});
    return {axle:axle,units:'normalized',confidence:'illustrative-unmeasured',points:points,wheels:wheels,links:links,
      frame:{mounts:mounts,outline:outline,innerOutline:innerOutline,heave:heave,roll:roll},
      mechanics:{rack:rack,drive:finite(inputs.drive,0),antirollAngle:wheels.L.antiroll.angle-wheels.R.antiroll.angle,
        travelL:qL,travelR:qR,bodyL:bl,bodyR:br},
      solver:{ok:allOK,clamped:qL!==finite(inputs.travelL,0)||qR!==finite(inputs.travelR,0)||rack!==finite(inputs.rack,0),
        maxError:Math.max(wheels.L.solver.error,wheels.R.solver.error,wheels.L.antiroll.linkError,wheels.R.antiroll.linkError),
        confidence:allOK?'normalized-constraint-solution':'limited-last-valid-solution'}};
  }

  function project(p,view) {
    if(!p)return null;
    if(view==='side')return {x:p.x,y:-p.z};
    if(view==='top')return {x:p.y,y:-p.x};
    return {x:p.y,y:-p.z};
  }
  function initialAxle(){return [{zs:0,zu:0,vs:0,vu:0},{zs:0,zu:0,vs:0,vu:0}];}
  function Simulation(options) {
    this.params={spring:1,damping:1,antiroll:1};this.setParameters(options||{});this.reset();
  }
  Simulation.prototype.setParameters=function(options) {
    if(options.spring!==undefined)this.params.spring=clamp(finite(options.spring,1),0.1,3);
    if(options.damping!==undefined)this.params.damping=clamp(finite(options.damping,1),0,3);
    if(options.antiroll!==undefined)this.params.antiroll=clamp(finite(options.antiroll,1),0,3);
    return this;
  };
  Simulation.prototype.reset=function(){
    this.state={front:initialAxle(),rear:initialAxle()};this.time=0;this.drivePhase=0;
    this.inputs={roadL:0,roadR:0,rack:0,drive:0};return this;
  };
  Simulation.prototype.step=function(dt,inputs) {
    inputs=inputs||{};this.setParameters(inputs);
    this.inputs={roadL:clamp(finite(inputs.roadL,0),-0.18,0.18),roadR:clamp(finite(inputs.roadR,0),-0.18,0.18),
      rack:clamp(finite(inputs.rack,0),-0.18,0.18),drive:finite(inputs.drive,0)};
    dt=clamp(finite(dt,0),0,0.25);var count=Math.max(1,Math.ceil(dt*480)),h=dt/count,self=this;
    for(var n=0;n<count;n++) {
      ['front','rear'].forEach(function(axle){
        var a=self.state[axle],q=a.map(function(w){return w.zu-w.zs;}),
          qv=a.map(function(w){return w.vu-w.vs;}),ks=18*self.params.spring,c=2.8*self.params.damping,
          ka=7*self.params.antiroll,bar=ka*(q[0]-q[1]);
        a.forEach(function(w,i){
          var road=i===0?self.inputs.roadL:self.inputs.roadR;
          var stop=220*Math.sign(q[i])*Math.pow(Math.max(0,Math.abs(q[i])-0.16),1.5);
          var fs=ks*q[i],fd=c*qv[i],fb=(i===0?bar:-bar),body=fs+fd+fb+stop;
          var tire=-160*(w.zu-road)-0.45*w.vu;
          w.vs+=h*body;w.vu+=h*(tire-body)/0.12;
          w.zs+=h*w.vs;w.zu+=h*w.vu;
          w.forces={spring:fs,damper:fd,antiroll:fb,bumpStop:stop,tire:tire,body:body};
        });
      });
      this.time+=h;this.drivePhase+=h*this.inputs.drive;
    }
    return this;
  };
  Simulation.prototype.snapshot=function(axle) {
    axle=axle==='rear'?'rear':'front';var s=this.state[axle],scene=solvePose(axle,{
      travelL:s[0].zu-s[0].zs,travelR:s[1].zu-s[1].zs,bodyL:s[0].zs,bodyR:s[1].zs,
      rack:this.inputs.rack,drive:this.drivePhase});
    scene.time=this.time;scene.mechanics.parameters=Object.assign({},this.params);
    scene.mechanics.roadL=this.inputs.roadL;scene.mechanics.roadR=this.inputs.roadR;
    ['L','R'].forEach(function(side,i){
      var w=s[i];scene.wheels[side].compression=w.zu-w.zs;
      scene.wheels[side].velocity=w.vu-w.vs;scene.wheels[side].bodyVelocity=w.vs;
      scene.wheels[side].forces=Object.assign({spring:0,damper:0,antiroll:0,bumpStop:0,tire:0,body:0},w.forces||{});
      scene.wheels[side].rotation=scene.mechanics.drive;
    });
    return scene;
  };

  function selfTest() {
    var result={pass:true,cases:0,maxArmError:0,maxTieError:0,maxStrutError:0,maxRearLinkError:0,
      maxTrailingError:0,maxDropLinkError:0,maxSolverError:0,maxRigidFrameError:0,maxAxesError:0,failed:[]};
    [-0.22,-0.11,0,0.11,0.22].forEach(function(q){[-0.18,-0.09,0,0.09,0.18].forEach(function(r){
      ['front','rear'].forEach(function(axle){
        var scene=solvePose(axle,{travelL:q,travelR:-q*0.6,rack:r,bodyL:0.025,bodyR:-0.025});
        result.cases++;
        result.maxRigidFrameError=Math.max(result.maxRigidFrameError,
          Math.abs(distance(scene.frame.mounts[0].point,scene.frame.mounts[1].point)-0.92),
          Math.abs(distance(scene.frame.mounts[0].point,scene.frame.mounts[2].point)-0.68));
        ['L','R'].forEach(function(s){
          var w=scene.wheels[s],c=w.constraints;
          result.maxAxesError=Math.max(result.maxAxesError,Math.abs(length(w.axes.up)-1),
            Math.abs(length(w.axes.out)-1),Math.abs(length(w.axes.forward)-1),
            Math.abs(dot(w.axes.up,w.axes.out)),Math.abs(dot(w.axes.up,w.axes.forward)),Math.abs(dot(w.axes.out,w.axes.forward)));
          result.maxArmError=Math.max(result.maxArmError,c.armError||0);
          result.maxTieError=Math.max(result.maxTieError,c.tieError||0);
          result.maxStrutError=Math.max(result.maxStrutError,c.strutError||0);
          result.maxRearLinkError=Math.max(result.maxRearLinkError,c.upperLinkError||0,c.lowerLinkError||0);
          result.maxTrailingError=Math.max(result.maxTrailingError,c.trailingError||0);
          result.maxDropLinkError=Math.max(result.maxDropLinkError,w.antiroll.linkError);
          result.maxSolverError=Math.max(result.maxSolverError,w.solver.error);
        });
        if(!scene.solver.ok)result.failed.push({axle:axle,travel:q,rack:r,error:scene.solver.maxError});
      });
    });});
    var sim=new Simulation(),maxState=0;
    for(var i=0;i<900;i++) {
      sim.step(1/120,{roadL:0.07*Math.sin(i/25),roadR:0.04*Math.sin(i/31),rack:0.08*Math.sin(i/60)});
      ['front','rear'].forEach(function(a){sim.state[a].forEach(function(w){maxState=Math.max(maxState,Math.abs(w.zs),Math.abs(w.zu));});});
    }
    var neutral=solvePose('front',{}),roll=solvePose('front',{travelL:0.08,travelR:-0.08});
    result.neutralSteerError=Math.abs(neutral.wheels.L.steer)+Math.abs(neutral.wheels.R.steer);
    result.symmetricAntirollError=Math.abs(solvePose('front',{travelL:0.08,travelR:0.08}).mechanics.antirollAngle);
    result.oppositeAntiroll=Math.abs(roll.mechanics.antirollAngle);
    result.maxDynamicState=maxState;
    var steering=solvePose('front',{rack:0.14});
    result.innerSteeringAdvantage=Math.abs(steering.wheels.R.steer)-Math.abs(steering.wheels.L.steer);
    result.neutralCVPlunge=Math.abs(neutral.wheels.L.cv.plunge);
    result.pass=result.failed.length===0&&result.maxSolverError<1e-7&&result.maxDropLinkError<1e-7&&
      result.maxArmError<1e-8&&result.maxTieError<1e-7&&result.maxRearLinkError<1e-7&&
      result.maxRigidFrameError<1e-8&&result.maxAxesError<1e-8&&result.innerSteeringAdvantage>0&&result.neutralCVPlunge<1e-8&&
      result.neutralSteerError<1e-8&&result.symmetricAntirollError<1e-8&&result.oppositeAntiroll>0.01&&
      Number.isFinite(maxState)&&maxState<1;
    return result;
  }
  var schema={units:'normalized (not Nissan dimensions, forces or time calibration)',axes:'x forward; y vehicle-left; z up',
    inputs:'travel[-.22,.22], rack[-.18,.18], bodyL/bodyR normalized heights; drive radians',
    pointNames:POINT_NAMES.slice(),components:COMPONENTS,
    notes:['Points are 3D {x,y,z}; absent corner components are null.',
      'front view: +y right, +z up; side: +x right, +z up; top: +y right, +x up.',
      'frame.mounts has exactly four body-fixed anchors; frame.outline is closed.',
      'All views must project this same geometry. Do not recalculate independent link motion.',
      'Lower arms, tie rods and rear links preserve lengths; struts/inner CV plunge telescope.',
      'solver.ok=false means a limit; corner solver retains the last valid continuation state.',
      'Rear front trailing-arm bush is a spherical idealization; elasticity is not reconstructed.']};
  return {Simulation:Simulation,solvePose:solvePose,project:project,selfTest:selfTest,schema:schema};
});
