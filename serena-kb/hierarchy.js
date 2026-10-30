/* Shared catalogue tree for desktop navigation, mobile selection and card relationships. */
globalThis.SerenaHierarchy = (() => {
  'use strict';
  function create(db) {
    const byId=Object.fromEntries(db.components.map(p=>[p.id,p]));
    const byGroup=Object.fromEntries(db.assemblies.map(a=>[a.id,a]));
    const unique=ids=>[...new Set(ids)].map(id=>byId[id]).filter(Boolean);
    const pageParts=system=>unique([...db.components.filter(p=>p.system===system).map(p=>p.id),...(db.systems.find(s=>s.id===system)?.contextParts||[])]);
    const members=(group,parts)=>{
      const visible=new Set(parts.map(p=>p.id));
      return unique([group.root,...group.children]).filter(p=>visible.has(p.id));
    };
    const groupsFor=parts=>db.assemblies.filter(a=>members(a,parts).length);
    const roots=groups=>groups.filter(a=>!groups.some(parent=>parent.id===a.parentAssemblyId));
    const subgroups=(group,groups)=>groups.filter(a=>a.parentAssemblyId===group.id);
    function rows(group,parts) {
      const items=members(group,parts),ids=new Set(items.map(p=>p.id)),result=[];
      function visit(part,depth) {
        result.push({part,depth});
        items.filter(p=>p.parentId===part.id).forEach(p=>visit(p,depth+1));
      }
      items.filter(p=>!ids.has(p.parentId)).forEach(p=>visit(p,0));
      return result;
    }
    function ordered(parts) {
      const groups=groupsFor(parts),result=[];
      function visit(group,depth) {
        result.push({group,depth,rows:rows(group,parts)});
        subgroups(group,groups).forEach(a=>visit(a,depth+1));
      }
      roots(groups).forEach(a=>visit(a,0));
      return result;
    }
    function ancestors(part) {
      const result=[];
      for(let parent=byId[part.parentId];parent;parent=byId[parent.parentId])result.unshift(parent);
      return result;
    }
    const children=part=>db.components.filter(p=>p.parentId===part.id);
    const related=part=>unique([...children(part).map(p=>p.id),part.parentId,...(byGroup[part.assemblyId]?.relatedPartIds||[]),...(children(part).length?[]:[byGroup[part.assemblyId]?.root,...(byGroup[part.assemblyId]?.children||[])])]).filter(p=>p.id!==part.id);
    return {pageParts,members,groupsFor,roots,subgroups,rows,ordered,ancestors,children,related};
  }
  return {create};
})();
