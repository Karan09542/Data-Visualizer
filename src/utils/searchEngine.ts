import JSON5 from 'json5';

/**
 * ----------------------------------------------------
 * QUERY AST & TOKENIZER
 * True structural graph query engine with parsing, 
 * validation, and explicit traversal semantics.
 * ----------------------------------------------------
 */

export interface QueryContext {
  meta: {
    id: string;
    name: string;
    path: string;
    type: string;
    depth: number;
    childrenCount: number;
  };
  node: any; // Raw JSON node structure
  mode: 'strict' | 'permissive';
  errors: string[];
  suggestions: string[];
}

export interface TraversalResult {
  value: any;
  path: string;
  parent: any;
  key: string | null;
  arrayIndex: number | null;
  source: any;
  scopeId: string;
  nodeType: 'object' | 'array' | 'primitive';
}

export interface EvalResult {
  isMatch: boolean;
  errors: string[];
  suggestions: string[];
}

export interface ParseResult {
  ast: Expr | null;
  syntaxError?: string;
}

type TokenType = 
  | 'IDENTIFIER' | 'STRING' | 'NUMBER' | 'REGEX' 
  | 'OPERATOR' | 'DOT' | 'BRACKET_OPEN' | 'BRACKET_CLOSE' 
  | 'PAREN_OPEN' | 'PAREN_CLOSE' | 'AND' | 'OR' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  
  while (cursor < input.length) {
    const char = input[cursor];
    
    if (/\s/.test(char)) { cursor++; continue; }
    
    if (char === '.') { tokens.push({ type: 'DOT', value: '.', start: cursor, end: cursor + 1 }); cursor++; continue; }
    if (char === '[') { tokens.push({ type: 'BRACKET_OPEN', value: '[', start: cursor, end: cursor + 1 }); cursor++; continue; }
    if (char === ']') { tokens.push({ type: 'BRACKET_CLOSE', value: ']', start: cursor, end: cursor + 1 }); cursor++; continue; }
    if (char === '(') { tokens.push({ type: 'PAREN_OPEN', value: '(', start: cursor, end: cursor + 1 }); cursor++; continue; }
    if (char === ')') { tokens.push({ type: 'PAREN_CLOSE', value: ')', start: cursor, end: cursor + 1 }); cursor++; continue; }
    
    // Regex literal e.g. /^auth/i or any other literal
    if (char === '/') {
       const twoChar = input.slice(cursor, cursor + 2);
       if (twoChar === '/=') {
           tokens.push({ type: 'OPERATOR', value: '/=', start: cursor, end: cursor + 2 });
           cursor += 2;
           continue;
       }
       // Try pattern parsing for regex literal
       let temp = cursor + 1;
       let escaped = false;
       let closed = false;
       while (temp < input.length) {
           if (escaped) { escaped = false; temp++; continue; }
           if (input[temp] === '\\') { escaped = true; temp++; continue; }
           if (input[temp] === '/') { closed = true; temp++; break; }
           temp++;
       }
       if (closed) {
           let endIdx = temp + 1;
           let flags = '';
           while (endIdx < input.length && /[gimuy]/.test(input[endIdx])) {
               flags += input[endIdx];
               endIdx++;
           }
           tokens.push({ type: 'REGEX', value: input.slice(cursor + 1, temp), start: cursor, end: endIdx });
           cursor = endIdx;
           continue;
       }
    }

    // Operators
    let operatorFound = false;
    for (const op of ['~=', '*=', '/=', '>=', '<=', '==', '!=']) {
       if (input.slice(cursor, cursor + op.length) === op) {
          tokens.push({ type: 'OPERATOR', value: op, start: cursor, end: cursor + op.length });
          cursor += op.length;
          operatorFound = true;
          break;
       }
    }
    if (operatorFound) continue;
    
    for (const op of ['>', '<', '=', '!', ':']) {
       if (char === op) {
          tokens.push({ type: 'OPERATOR', value: op, start: cursor, end: cursor + 1 });
          cursor++;
          operatorFound = true;
          break;
       }
    }
    if (operatorFound) continue;
    
    if (char === '"' || char === "'") {
       let quote = char;
       let str = '';
       cursor++;
       let start = cursor;
       while (cursor < input.length && input[cursor] !== quote) {
           if (input[cursor] === '\\') { cursor++; str += input[cursor] || ''; }
           else { str += input[cursor]; }
           cursor++;
       }
       tokens.push({ type: 'STRING', value: str, start: start - 1, end: cursor + 1 });
       cursor++;
       continue;
    }

    if (/-?\d/.test(input.slice(cursor, cursor + 2)) || /^\d/.test(char)) {
       let numMatch = input.slice(cursor).match(/^-?\d+(\.\d+)?/);
       if (numMatch) {
          tokens.push({ type: 'NUMBER', value: numMatch[0], start: cursor, end: cursor + numMatch[0].length });
          cursor += numMatch[0].length;
          continue;
       }
    }
    
    let anyWordMatch = input.slice(cursor).match(/^[-a-zA-Z0-9_$@]+/);
    if (anyWordMatch) {
       let val = anyWordMatch[0];
       let upper = val.toUpperCase();
       
       if (upper === 'AND') { tokens.push({ type: 'AND', value: val, start: cursor, end: cursor + val.length }); }
       else if (upper === 'OR') { tokens.push({ type: 'OR', value: val, start: cursor, end: cursor + val.length }); }
       else { tokens.push({ type: 'IDENTIFIER', value: val, start: cursor, end: cursor + val.length }); }
       
       cursor += val.length;
       continue;
    }
    
    // unknown char, just skip
    cursor++;
  }
  
  tokens.push({ type: 'EOF', value: '', start: cursor, end: cursor });
  return tokens;
}

export type Expr = 
  | { type: 'LogicalExpr', op: 'AND' | 'OR', left: Expr, right: Expr }
  | { type: 'CompareExpr', path: PathAST, op: string, value: any, valueType: 'regex' | 'string' | 'number' | 'boolean' }
  | { type: 'FuzzyMatchExpr', value: string }
  | { type: 'GroupExpr', expr: Expr };

export type PathNode = 
  | { type: 'property', key: string }
  | { type: 'array-wildcard' }
  | { type: 'array-index', index: number };

export type PathAST = PathNode[];

function parseMongoJSON(json: any): Expr | null {
   if (typeof json !== 'object' || json === null) return null;
   
   let exprs: Expr[] = [];
   
   if (Array.isArray(json.$and)) {
       let lefts = json.$and.map(parseMongoJSON).filter(Boolean) as Expr[];
       if (lefts.length > 0) {
           let e = lefts.reduce((acc, curr) => ({ type: 'LogicalExpr', op: 'AND', left: acc, right: curr }));
           exprs.push({ type: 'GroupExpr', expr: e });
       }
   } else if (Array.isArray(json.$or)) {
       let lefts = json.$or.map(parseMongoJSON).filter(Boolean) as Expr[];
       if (lefts.length > 0) {
           let e = lefts.reduce((acc, curr) => ({ type: 'LogicalExpr', op: 'OR', left: acc, right: curr }));
           exprs.push({ type: 'GroupExpr', expr: e });
       }
   }
   
   for (let [key, value] of Object.entries(json)) {
       if (key === '$text') {
           exprs.push({ type: 'FuzzyMatchExpr', value: String(value) });
           continue;
       }
       if (key === '$and' || key === '$or') continue;
       
       let path = key.split('.').map(k => ({ type: 'property', key: k } as PathNode));
       
       if (typeof value === 'object' && value !== null) {
           for (let [op, opVal] of Object.entries(value)) {
               let cmpOp = ':';
               let vType: 'string' | 'number' | 'boolean' | 'regex' = typeof opVal === 'number' ? 'number' : typeof opVal === 'boolean' ? 'boolean' : 'string';
               if (op === '$eq') cmpOp = '=';
               if (op === '$ne') cmpOp = '!=';
               if (op === '$gt') cmpOp = '>';
               if (op === '$gte') cmpOp = '>=';
               if (op === '$lt') cmpOp = '<';
               if (op === '$lte') cmpOp = '<=';
               if (op === '$regex') {
                   cmpOp = '/=';
                   vType = 'regex';
               }
               exprs.push({ type: 'CompareExpr', path, op: cmpOp, value: opVal, valueType: vType });
           }
       } else {
           let vType: 'string' | 'number' | 'boolean' = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
           exprs.push({ type: 'CompareExpr', path, op: ':', value: value, valueType: vType });
       }
   }
   
   if (exprs.length === 0) return null;
   return exprs.reduce((acc, curr) => ({ type: 'LogicalExpr', op: 'AND', left: acc, right: curr }));
}

export function parseAST(input: string): ParseResult {
  let q = input.trim();
  if (!q) return { ast: null };
  
  if (q.startsWith('{') && q.endsWith('}')) {
    try {
      let json = JSON5.parse(q);
      const expr = parseMongoJSON(json);
      return { ast: expr };
    } catch (e) {
      // fallback
    }
  }
  
  const tokens = tokenize(q);
  let current = 0;
  
  function peek(): Token { return tokens[current]; }
  function advance(): Token { return tokens[current++]; }
  function isAtEnd(): boolean { return peek().type === 'EOF'; }
  function match(...types: TokenType[]): boolean {
     for (const t of types) {
       if (peek().type === t) { advance(); return true; }
     }
     return false;
  }
  
  try {
      const ast = expression();
      return { ast };
  } catch (err: any) {
      return { ast: null, syntaxError: err.message };
  }
  
  function expression(): Expr { return orExpr(); }
  
  function orExpr(): Expr {
      let expr = andExpr();
      while (match('OR')) {
          let right = andExpr();
          expr = { type: 'LogicalExpr', op: 'OR', left: expr, right };
      }
      return expr;
  }
  
  function andExpr(): Expr {
      let expr = primaryExpr();
      while (match('AND') || isImplicitAndReady()) {
          if (peek().type === 'AND') advance();
          let right = primaryExpr();
          expr = { type: 'LogicalExpr', op: 'AND', left: expr, right };
      }
      return expr;
  }
  
  function isImplicitAndReady() {
     const t = peek().type;
     return t === 'IDENTIFIER' || t === 'STRING' || t === 'NUMBER' || t === 'PAREN_OPEN' || t === 'REGEX';
  }
  
  function primaryExpr(): Expr {
      if (match('PAREN_OPEN')) {
          let expr = expression();
          if (peek().type === 'PAREN_CLOSE') {
              advance();
          } else {
              throw new Error("Expected ')'");
          }
          return { type: 'GroupExpr', expr };
      }
      
      let t = peek();
      
      if (t.type === 'STRING') {
          advance();
          return { type: 'FuzzyMatchExpr', value: t.value };
      }
      
      if (t.type === 'IDENTIFIER') {
          let path = parsePath();
          let next = peek();
          
          if (next.type === 'OPERATOR') {
             advance();
             let op = next.value;
             let rightToken = advance();
             
             if (rightToken.type === 'EOF') {
                 throw new Error(`Expected value after operator '${op}'`);
             }
             
             let val: any = rightToken.value;
             let valType: any = 'string';
             
             if (rightToken.type === 'NUMBER') {
                 val = Number(val);
                 valType = 'number';
             }
             else if (rightToken.type === 'REGEX') {
                 valType = 'regex';
             }
             else if (val === 'true') {
                 val = true;
                 valType = 'boolean';
             }
             else if (val === 'false') {
                 val = false;
                 valType = 'boolean';
             }
             
             return { type: 'CompareExpr', path, op, value: val, valueType: valType };
          }
          
          return { type: 'FuzzyMatchExpr', value: pathToString(path) };
      }
      
      let tok = advance();
      if (tok.type === 'EOF') return { type: 'FuzzyMatchExpr', value: '' };
      return { type: 'FuzzyMatchExpr', value: tok.value };
  }
  
  function parsePath(): PathAST {
      let path: PathAST = [];
      let tok = advance();
      path.push({ type: 'property', key: tok.value });
      
      while (!isAtEnd()) {
          if (peek().type === 'DOT') {
              advance();
              if (peek().type === 'IDENTIFIER') {
                  path.push({ type: 'property', key: advance().value });
              } else {
                  throw new Error("Expected property name after '.'");
              }
          } else if (peek().type === 'BRACKET_OPEN') {
              advance();
              if (peek().type === 'BRACKET_CLOSE') {
                  advance();
                  path.push({ type: 'array-wildcard' });
              } else if (peek().type === 'NUMBER') {
                  let num = advance().value;
                  path.push({ type: 'array-index', index: Number(num) });
                  if (peek().type === 'BRACKET_CLOSE') {
                      advance();
                  } else {
                      throw new Error("Expected ']'");
                  }
              }
          } else {
              break;
          }
      }
      return path;
  }
}

function pathToString(path: PathAST): string {
    let s = '';
    for (let i = 0; i < path.length; i++) {
        let p = path[i];
        if (p.type === 'property') {
            s += (i > 0 ? '.' : '') + p.key;
        } else if (p.type === 'array-wildcard') {
            s += '[]';
        } else if (p.type === 'array-index') {
            s += `[${p.index}]`;
        }
    }
    return s;
}

export function parseSearchQuery(queryString: string): ParseResult {
    return parseAST(queryString);
}

export function buildSearchContext(node: any, depth = 0): QueryContext {
  const rawNode = node.data !== undefined ? node.data : node;
  return {
    meta: {
      id: node.id || rawNode.id || '',
      name: node.name || rawNode.name || '',
      path: node.path || rawNode.path || '',
      type: node.type || rawNode.type || '',
      depth: node.depth !== undefined ? node.depth : depth,
      childrenCount: node.children ? node.children.length : (rawNode.children?.length || 0),
    },
    node: rawNode,
    mode: 'permissive',
    errors: [],
    suggestions: []
  };
}

export function evaluateQuery(expr: Expr | null, ctx: QueryContext): EvalResult {
    ctx.errors = [];
    ctx.suggestions = [];
    
    if (!expr) return { isMatch: false, errors: [], suggestions: [] };
    
    const matchedResults = evalInternal(expr, ctx);
    const isMatch = matchedResults.length > 0;
    
    return {
        isMatch,
        errors: ctx.errors,
        suggestions: ctx.suggestions
    };
}

function areScopesCompatible(s1: string, s2: string): boolean {
    if (s1 === 'root' || s2 === 'root') return true;
    if (s1 === s2) return true;
    
    const p1 = s1.split('.');
    const p2 = s2.split('.');
    
    const minLen = Math.min(p1.length, p2.length);
    for (let i = 0; i < minLen; i++) {
        if (p1[i] !== p2[i]) return false;
    }
    return true;
}

function evalInternal(expr: Expr, ctx: QueryContext): TraversalResult[] {
    if (expr.type === 'GroupExpr') {
        return evalInternal(expr.expr, ctx);
    }
    
    if (expr.type === 'LogicalExpr') {
        if (expr.op === 'AND') {
            const leftResults = evalInternal(expr.left, ctx);
            const rightResults = evalInternal(expr.right, ctx);
            
            const finalKeptL = leftResults.filter(l => 
                rightResults.some(r => areScopesCompatible(l.scopeId, r.scopeId))
            );
            const finalKeptR = rightResults.filter(r => 
                leftResults.some(l => areScopesCompatible(l.scopeId, r.scopeId))
            );
            
            return [...finalKeptL, ...finalKeptR];
        }
        if (expr.op === 'OR') {
            const leftResults = evalInternal(expr.left, ctx);
            const rightResults = evalInternal(expr.right, ctx);
            
            // concatenate and deduplicate
            const seen = new Set<string>();
            const union: TraversalResult[] = [];
            for (const r of [...leftResults, ...rightResults]) {
                const itemKey = `${r.scopeId}:${r.path}`;
                if (!seen.has(itemKey)) {
                    seen.add(itemKey);
                    union.push(r);
                }
            }
            return union;
        }
    }
    
    if (expr.type === 'FuzzyMatchExpr') {
        const query = expr.value.toLowerCase();
        const results: TraversalResult[] = [];
        
        // Match exact strings in meta
        for (const [key, value] of Object.entries(ctx.meta)) {
            if (String(value).toLowerCase().includes(query)) {
                results.push({
                    value,
                    path: `meta.${key}`,
                    parent: ctx.meta,
                    key,
                    arrayIndex: null,
                    source: ctx.node,
                    scopeId: 'root',
                    nodeType: 'primitive'
                });
            }
        }
        
        // Search values structural (directly at top-level instead of flat JSON.stringify recursive)
        if (typeof ctx.node === 'string') {
           if (ctx.node.toLowerCase().includes(query)) {
               results.push({
                   value: ctx.node,
                   path: 'root',
                   parent: null,
                   key: null,
                   arrayIndex: null,
                   source: ctx.node,
                   scopeId: 'root',
                   nodeType: 'primitive'
               });
           }
        } else if (typeof ctx.node === 'number') {
           if (String(ctx.node).includes(query)) {
               results.push({
                   value: ctx.node,
                   path: 'root',
                   parent: null,
                   key: null,
                   arrayIndex: null,
                   source: ctx.node,
                   scopeId: 'root',
                   nodeType: 'primitive'
               });
           }
        } else if (typeof ctx.node === 'object' && ctx.node !== null) {
           for (const [k, v] of Object.entries(ctx.node)) {
                if (v === null || v === undefined) continue;
                if (typeof v === 'string') {
                    if (v.toLowerCase().includes(query)) {
                        results.push({
                            value: v,
                            path: k,
                            parent: ctx.node,
                            key: k,
                            arrayIndex: null,
                            source: ctx.node,
                            scopeId: 'root',
                            nodeType: 'primitive'
                        });
                    }
                } else if (typeof v === 'number') {
                    if (String(v).includes(query)) {
                        results.push({
                            value: v,
                            path: k,
                            parent: ctx.node,
                            key: k,
                            arrayIndex: null,
                            source: ctx.node,
                            scopeId: 'root',
                            nodeType: 'primitive'
                        });
                    }
                }
           }
        }
        
        return results;
    }
    
    if (expr.type === 'CompareExpr') {
        let firstKey = expr.path[0].type === 'property' ? expr.path[0].key : '';
        let isMeta = ['id', 'name', 'path', 'type', 'depth', 'childrenCount'].includes(firstKey);
        
        let resolved: TraversalResult[] = [];
        
        if (isMeta && expr.path.length === 1) {
            const actual = (ctx.meta as any)[firstKey];
            resolved = [{
                value: actual,
                path: firstKey,
                parent: ctx.meta,
                key: firstKey,
                arrayIndex: null,
                source: ctx.node,
                scopeId: 'root',
                nodeType: 'primitive'
            }];
        } else {
            resolved = traversePath(ctx.node, expr.path, ctx.mode, ctx);
        }
        
        let op = expr.op;
        let cValue = expr.value;
        
        const matched = resolved.filter(res => 
            compareValues(res.value, op, cValue, expr.valueType)
        );
        
        return matched;
    }
    
    return [];
}

function normalizeSemantic(val: any): string {
    if (val === null || val === undefined) return '';
    return String(val).trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareValues(actual: any, op: string, cValue: any, cType: 'string'|'number'|'boolean'|'regex'): boolean {
    if (op === ':') {
        // strict semantic equality (case-insensitive, trimmed whitespace)
        const normActual = typeof actual === 'string' ? normalizeSemantic(actual) : actual;
        const normCValue = typeof cValue === 'string' ? normalizeSemantic(cValue) : cValue;
        return normActual === normCValue;
    }
    if (op === '~=') {
        // fuzzy semantic match (multi-word overlap containment)
        let strVal = normalizeSemantic(actual);
        let strQ = normalizeSemantic(cValue);
        if (strVal.includes(strQ)) return true;
        let terms = strQ.split(' ').filter(Boolean);
        if (terms.length > 0 && terms.every(t => strVal.includes(t))) return true;
        return false;
    }
    if (op === '*=') {
        // substring contains (case sensitive, exact)
        if (typeof actual === 'string' && typeof cValue === 'string') {
            return actual.includes(cValue);
        }
        return false;
    }
    if (op === '/=') {
        // regex match
        try {
            const regex = new RegExp(cValue, 'i');
            return regex.test(String(actual));
        } catch { 
            return false; 
        }
    }
    
    if (op === '=' || op === '==') return actual == cValue;
    if (op === '!=') return actual != cValue;
    if (op === '>') return actual > cValue;
    if (op === '<') return actual < cValue;
    if (op === '>=') return actual >= cValue;
    if (op === '<=') return actual <= cValue;
    return false;
}

function traversePath(node: any, path: PathAST, mode: 'strict' | 'permissive', ctx: QueryContext): TraversalResult[] {
    function dig(current: any, pIdx: number, currentPath: string, currentScopeId: string, parentObj: any, parentKey: string | null, parentIndex: number | null): TraversalResult[] {
        if (pIdx >= path.length) {
            const nodeType = current === null ? 'primitive' : Array.isArray(current) ? 'array' : typeof current === 'object' ? 'object' : 'primitive';
            return [{
                value: current,
                path: currentPath,
                parent: parentObj,
                key: parentKey,
                arrayIndex: parentIndex,
                source: ctx.node,
                scopeId: currentScopeId || 'root',
                nodeType
            }];
        }
        
        let pNode = path[pIdx];
        
        if (current === null || current === undefined) {
             if (mode === 'strict') {
                  const keyName = pNode.type === 'property' ? pNode.key : 'index';
                  let msg = `Cannot access "${keyName}" on null/undefined at "${currentPath || 'root'}".`;
                  if (!ctx.errors.includes(msg)) ctx.errors.push(msg);
             }
             return [];
        }
        
        if (pNode.type === 'property') {
            if (Array.isArray(current)) {
                if (mode === 'strict') {
                     let msg = `Cannot access property "${pNode.key}" on array directly at "${currentPath || 'root'}".`;
                     if (!ctx.errors.includes(msg)) ctx.errors.push(msg);
                     let sug = `Did you mean "${currentPath || 'root'}[].${pNode.key}"?`;
                     if (!ctx.suggestions.includes(sug)) ctx.suggestions.push(sug);
                     return [];
                } else {
                     let results: TraversalResult[] = [];
                     for (let i=0; i < current.length; i++) {
                          let nextScope = currentScopeId ? `${currentScopeId}.${i}` : `${i}`;
                          results.push(...dig(current[i], pIdx, `${currentPath}[${i}]`, nextScope, current, null, i));
                     }
                     return results;
                }
            }
            
            if (typeof current !== 'object') {
                if (mode === 'strict') {
                     let msg = `Cannot access property "${pNode.key}" on primitive ${typeof current} at "${currentPath || 'root'}".`;
                     if (!ctx.errors.includes(msg)) ctx.errors.push(msg);
                }
                return [];
            }
            
            let nextPath = currentPath ? `${currentPath}.${pNode.key}` : pNode.key;
            return dig(current[pNode.key], pIdx + 1, nextPath, currentScopeId, current, pNode.key, null);
        }
        else if (pNode.type === 'array-wildcard') {
            if (!Array.isArray(current)) {
                 if (mode === 'strict') {
                     let msg = `Cannot use [] on non-array at "${currentPath || 'root'}".`;
                     if (!ctx.errors.includes(msg)) ctx.errors.push(msg);
                     return [];
                 } else {
                     return dig(current, pIdx + 1, currentPath, currentScopeId, parentObj, parentKey, parentIndex); 
                 }
            }
            
            let results: TraversalResult[] = [];
            for (let i=0; i < current.length; i++) {
                 let nextScope = currentScopeId ? `${currentScopeId}.${i}` : `${i}`;
                 results.push(...dig(current[i], pIdx + 1, `${currentPath}[${i}]`, nextScope, current, null, i));
            }
            return results;
        }
        else if (pNode.type === 'array-index') {
            if (!Array.isArray(current)) {
                 if (mode === 'strict') {
                      let msg = `Cannot use [${pNode.index}] on non-array at "${currentPath || 'root'}".`;
                      if (!ctx.errors.includes(msg)) ctx.errors.push(msg);
                 }
                 return [];
            }
            return dig(current[pNode.index], pIdx + 1, `${currentPath}[${pNode.index}]`, currentScopeId, current, null, pNode.index);
        }
        
        return [];
    }
    
    return dig(node, 0, "", "", null, null, null);
}
