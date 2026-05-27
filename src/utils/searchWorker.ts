import { parseSearchQuery, buildSearchContext, evaluateQuery } from './searchEngine';

self.onmessage = (e) => {
  const { query, treeData, searchEngineMode } = e.data;
  const q = query.trim();
  const matches = new Set<string>();
  const ancestors = new Set<string>();
  const globalErrors = new Set<string>();
  const globalSuggestions = new Set<string>();
  const newCollapsedPaths = new Set<string>(); // Paths that should be EXPANDED

  if (!q || !treeData) {
    self.postMessage({ 
      query, 
      matches: [], 
      ancestors: [], 
      globalErrors: [], 
      globalSuggestions: [], 
      newCollapsedPaths: [], 
      activeIndex: null, 
      activeId: null 
    });
    return;
  }

  const parseRes = parseSearchQuery(q);
  if (parseRes.syntaxError) {
    globalErrors.add(parseRes.syntaxError);
    self.postMessage({ 
      query, 
      matches: [], 
      ancestors: [], 
      globalErrors: Array.from(globalErrors), 
      globalSuggestions: [], 
      newCollapsedPaths: [], 
      activeIndex: null, 
      activeId: null 
    });
    return;
  }

  const checkNode = (node: any, currentAncestors: string[], depth: number): boolean => {
    let isMatch = false;
    let handledMatches = false;
    
    if (parseRes.ast) {
       const context = buildSearchContext(node, depth);
       context.mode = searchEngineMode;
       const evalRes = evaluateQuery(parseRes.ast, context);
       isMatch = evalRes.isMatch;
       
       if (isMatch && evalRes.matchedPaths && evalRes.matchedPaths.length > 0) {
           handledMatches = true;
           for (const p of evalRes.matchedPaths) {
               matches.add(p);
               
               const parts = p.match(/root|\[\d+\]|[^.\[]+/g) || [];
               let temp = '';
               for (let i = 0; i < parts.length; i++) {
                   let part = parts[i];
                   if (i > 0 && part !== 'root' && !part.startsWith('[')) {
                       temp += '.' + part;
                   } else {
                       temp += part;
                   }
                   ancestors.add(temp);
                   newCollapsedPaths.add(temp);
               }
           }
           for (const c of currentAncestors) {
               ancestors.add(c);
               newCollapsedPaths.add(c);
           }
           ancestors.add(node.id);
           newCollapsedPaths.add(node.id);
       }
       
       for (const sug of evalRes.suggestions) globalSuggestions.add(sug);
    } else {
       const qLower = q.toLowerCase();
       const matchName = node.name.toLowerCase().includes(qLower);
       const matchVal = node.value !== undefined && String(node.value).toLowerCase().includes(qLower);
       isMatch = matchName || matchVal;
    }
    
    let hasMatchingDescendant = false;
    
    if (node.children) {
       for (const child of node.children) {
          if (checkNode(child, [...currentAncestors, node.id], depth + 1)) {
             hasMatchingDescendant = true;
          }
       }
    }
    
    if (isMatch && !handledMatches) {
       matches.add(node.id);
       for (const id of currentAncestors) {
          ancestors.add(id);
          newCollapsedPaths.add(id); 
       }
    } else if (hasMatchingDescendant) {
       ancestors.add(node.id);
       newCollapsedPaths.add(node.id); 
    }
    
    return isMatch || hasMatchingDescendant;
  };
  
  checkNode(treeData, [], 0);
  
  const matchArray = Array.from(matches);
  const activeIndex = matchArray.length > 0 ? 0 : null;
  const activeId = matchArray.length > 0 ? matchArray[0] : null;

  self.postMessage({
    query,
    matches: matchArray,
    ancestors: Array.from(ancestors),
    globalErrors: Array.from(globalErrors),
    globalSuggestions: Array.from(globalSuggestions),
    newCollapsedPaths: Array.from(newCollapsedPaths),
    activeIndex,
    activeId
  });
};
