/* Kinematic teaching model. No longitudinal dynamics, clutch capacity or Nissan control map.
 * Published ratios are supplied by canonical data; radii and time remain normalized.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SerenaDrivetrain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const finite=(x,fallback)=>Number.isFinite(x)?x:fallback;
  const TAU=2*Math.PI;
  function beltLength(primary,secondary,distance){
    const delta=secondary-primary;
    return 2*Math.sqrt(distance*distance-delta*delta)+Math.PI*(primary+secondary)+2*delta*Math.asin(delta/distance);
  }
  function beltGeometry(ratio){
    const distance=.62,length=2*distance+TAU*.20;
    let low=.001,high=Math.min(.6,.99*distance/(Math.abs(ratio-1)||1));
    for(let n=0;n<60;n++){
      const r=(low+high)/2;
      if(beltLength(r,r*ratio,distance)>length)high=r;else low=r;
    }
    const primary=(low+high)/2,secondary=primary*ratio;
    return {primary,secondary,distance,length,alpha:Math.asin((secondary-primary)/distance)};
  }
  function Drivetrain(config={}){
    this.config={lowRatio:2.5,highRatio:.4,finalDrive:1,reverseRatio:1,...config};
    for(const key of ['lowRatio','highRatio','finalDrive','reverseRatio']){
      if(!Number.isFinite(this.config[key])||this.config[key]<=0)throw new RangeError('Invalid drivetrain '+key);
    }
    if(this.config.lowRatio<this.config.highRatio)throw new RangeError('Inverted CVT ratio range');
    this.reset();
  }
  Drivetrain.prototype.reset=function(){
    this.inputs={drive:0,ratioPosition:0,gear:'D',converter:'fluid',rearProtection:false};
    this.phases=Object.fromEntries(['engine','primary','secondary','frontCarrier','rearCarrier','prop','belt','FL','FR','RL','RR'].map(k=>[k,0]));
    this.steering={left:0,right:0};return this;
  };
  Drivetrain.prototype.setInputs=function(inputs={},steering=this.steering){
    const prev=this.inputs;
    this.inputs={drive:clamp(finite(inputs.drive,prev.drive),0,8),
      ratioPosition:clamp(finite(inputs.ratioPosition,prev.ratioPosition),0,1),
      gear:['D','N','R'].includes(inputs.gear)?inputs.gear:prev.gear,
      converter:['fluid','locked'].includes(inputs.converter)?inputs.converter:prev.converter,
      rearProtection:typeof inputs.rearProtection==='boolean'?inputs.rearProtection:prev.rearProtection};
    this.steering={left:finite(steering.left,0),right:finite(steering.right,0)};
    return this;
  };
  Drivetrain.prototype.snapshot=function(){
    const c=this.config,i=this.inputs;
    // R's published ratio includes its reversing gear. The pulley ratio is held at low.
    const ratio=i.gear==='R'?c.lowRatio:c.lowRatio*Math.pow(c.highRatio/c.lowRatio,i.ratioPosition);
    const belt=beltGeometry(ratio),engine=i.drive;
    const converterFactor=i.converter==='locked'?1:.72; // Demonstration only, not converter hydraulics.
    const turbine=engine*converterFactor;
    const primary=i.gear==='N'?0:i.gear==='R'?-turbine*ratio/c.reverseRatio:turbine;
    const secondary=primary/ratio,frontCarrier=secondary/c.finalDrive;
    // Pure rolling at four equal tyre radii. Steering comes from the existing axle solver.
    const steer=(this.steering.left+this.steering.right)/2;
    const curvature=Math.tan(steer)/3,halfTrack=1.42,wheelbase=3;
    const frontLeft=Math.hypot(1-curvature*halfTrack,curvature*wheelbase);
    const frontRight=Math.hypot(1+curvature*halfTrack,curvature*wheelbase);
    const frontMean=(frontLeft+frontRight)/2;
    const speeds={engine,primary,secondary,frontCarrier,
      FL:frontCarrier*frontLeft/frontMean,FR:frontCarrier*frontRight/frontMean,
      RL:frontCarrier*(1-curvature*halfTrack)/frontMean,RR:frontCarrier*(1+curvature*halfTrack)/frontMean};
    speeds.rearCarrier=(speeds.RL+speeds.RR)/2;
    // Equivalent rear-ratio scaling only: actual transfer/rear tooth counts are unknown.
    speeds.prop=frontCarrier;
    speeds.belt=primary*belt.primary;
    return {inputs:{...i},ratio,belt,speeds,phases:{...this.phases},steering:{...this.steering},
      converterFactor,finalDrive:c.finalDrive,rearDriven:i.gear!=='N'&&!i.rearProtection,
      transmitting:i.gear!=='N'&&engine>0,reverse:i.gear==='R',
      confidence:'kinematic-principle',actualTorqueNm:null,rearTorqueShare:null,actualTemperatureC:null};
  };
  Drivetrain.prototype.step=function(dt,inputs={},steering){
    this.setInputs(inputs,steering);
    const state=this.snapshot(),h=clamp(finite(dt,0),0,.25);
    for(const key of Object.keys(this.phases))this.phases[key]+=h*state.speeds[key];
    return this;
  };
  return {Drivetrain,beltGeometry,beltLength};
});
