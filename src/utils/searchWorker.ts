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
    if (!node) return false;
    let isMatch = false;
    let handledMatches = false;
    
    try {
      if (parseRes.ast) {
         const context = buildSearchContext(node, depth);
         context.mode = searchEngineMode;
         const evalRes = evaluateQuery(parseRes.ast, context);
         isMatch = !!evalRes.isMatch;
         
         if (isMatch && evalRes.matchedPaths && evalRes.matchedPaths.length > 0) {
             handledMatches = true;
             for (const p of evalRes.matchedPaths) {
                 if (!p) continue;
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
                 if (c) {
                     ancestors.add(c);
                     newCollapsedPaths.add(c);
                 }
             }
             if (node.id) {
                 ancestors.add(node.id);
                 newCollapsedPaths.add(node.id);
             }
         }
         
         if (evalRes.suggestions) {
             for (const sug of evalRes.suggestions) {
                 if (sug) globalSuggestions.add(sug);
             }
         }
      } else {
         const qLower = q.toLowerCase();
         const matchName = typeof node.name === 'string' ? node.name.toLowerCase().includes(qLower) : false;
         const matchVal = node.value !== undefined && String(node.value).toLowerCase().includes(qLower);
         isMatch = matchName || matchVal;
      }
    } catch (e) {
      console.error("Unable to search this item", node, e);
    }
    
    let hasMatchingDescendant = false;
    
    if (node.children && Array.isArray(node.children)) {
       for (const child of node.children) {
          if (child && checkNode(child, [...currentAncestors, node.id || ''], depth + 1)) {
             hasMatchingDescendant = true;
          }
       }
    }
    
    if (isMatch && !handledMatches && node.id) {
       matches.add(node.id);
       for (const id of currentAncestors) {
          if (id) {
              ancestors.add(id);
              newCollapsedPaths.add(id); 
          }
       }
    } else if (hasMatchingDescendant && node.id) {
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
