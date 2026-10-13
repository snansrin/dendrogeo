const FORBIDDEN={
  domain:new Set(['application','adapters','ui']),
  application:new Set(['adapters','ui'])
};

export const KNOWN_LEGACY_REFERENCES=new Map();

export function isForbiddenLayerDependency(fromLayer,toLayer){
  return !!FORBIDDEN[fromLayer]?.has(toLayer);
}
