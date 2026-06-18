export function sanitizeWorkspaceData(data: any): boolean {
  let changed = false;
  if (!data || typeof data !== "object") return changed;
  
  // Recursively traverse the JSON tree
  for (const key of Object.keys(data)) {
    const value = data[key];
    
    if (value && typeof value === "object") {
      const isSearchNode = typeof key === "string" && (key.endsWith("_search_node") || key.endsWith(".search"));
      
      // Check if it looks like a Search Node by checking typical large attributes
      if (isSearchNode && ("article" in value || "sections" in value || "content_urls" in value || "searchResults" in value)) {
        console.warn(`[Sanitizer] Found illegal large payload in node data at key: ${key}. Stripping data to prevent workspace bloat and keeping only storage references.`);
        
        // Retain only identity and IndexedDB reference keys
        const retained: any = {};
        if ("storageKey" in value) retained.storageKey = value.storageKey;
        if ("nodeId" in value) retained.nodeId = value.nodeId;
        if ("key" in value) retained.key = value.key;
        if ("type" in value && value.type !== "article") retained.type = value.type; // Don't preserve "article" type if that breaks rendering
        
        data[key] = retained;
        changed = true;
      } else {
        if (sanitizeWorkspaceData(value)) {
          changed = true;
        }
      }
    }
  }
  return changed;
}


