// Offline evidence only. Node identity, never proximity, joins OSM members.
// Closed cycles here do not prove spatial validity or administrative stages.
export function inspectMemberTopology(relation, ways) {
  const fail = reason => ({ok:false, reason, rings:[]});
  if (relation?.type !== 'relation' || relation.tags?.type !== 'multipolygon') return fail('not-multipolygon');
  if (!Array.isArray(relation.members) || !relation.members.length) return fail('missing-members');
  if (!Array.isArray(ways)) return fail('missing-ways');
  const byId = new Map();
  for (const way of ways) {
    if (!way || !Number.isSafeInteger(way.id) || way.id <= 0) return fail('invalid-way');
    if (byId.has(way.id)) return fail('duplicate-way');
    byId.set(way.id, way);
  }
  const memberIds = new Set(), groups = {outer:[], inner:[]};
  for (const member of relation.members) {
    if (member.type !== 'way' || !Object.hasOwn(groups, member.role)) return fail('unsupported-member');
    if (memberIds.has(member.ref)) return fail('duplicate-member');
    memberIds.add(member.ref);
    const way = byId.get(member.ref), nodes = way?.nodes;
    if (way?.type !== 'way' || !Array.isArray(nodes) || nodes.length < 2) return fail('missing-way');
    if (!nodes.every(id => Number.isSafeInteger(id) && id > 0)) return fail('invalid-node');
    if (nodes.some((id, i) => i && id === nodes[i-1])) return fail('repeated-edge-node');
    groups[member.role].push({id:way.id, nodes:[...nodes]});
  }
  if (!groups.outer.length) return fail('missing-outer');
  const rings = [];
  for (const [role, members] of Object.entries(groups)) {
    const degree = new Map();
    for (const {nodes} of members) for (let i=1; i<nodes.length; i++) {
      degree.set(nodes[i-1], (degree.get(nodes[i-1]) || 0)+1);
      degree.set(nodes[i], (degree.get(nodes[i]) || 0)+1);
    }
    // Reject both gaps and ambiguous junctions; no speculative backtracking.
    if ([...degree.values()].some(n => n !== 2)) return fail('open-or-ambiguous-chain');
    const remaining = [...members];
    while (remaining.length) {
      const first = remaining.shift(), nodes = [...first.nodes], wayIds = [first.id];
      while (nodes[0] !== nodes.at(-1)) {
        const tail = nodes.at(-1), index = remaining.findIndex(w => w.nodes[0] === tail || w.nodes.at(-1) === tail);
        if (index < 0) return fail('open-chain');
        const next = remaining.splice(index, 1)[0];
        const segment = next.nodes[0] === tail ? next.nodes : [...next.nodes].reverse();
        nodes.push(...segment.slice(1)); wayIds.push(next.id);
      }
      if (nodes.length < 4 || new Set(nodes.slice(0,-1)).size !== nodes.length-1) return fail('degenerate-cycle');
      rings.push({role, nodes, wayIds});
    }
  }
  return {ok:true, reason:null, rings};
}
