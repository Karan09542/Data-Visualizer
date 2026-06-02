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
  matchedPaths?: string[];
}

export interface ParseResult {
  ast: Expr | null;
  syntaxError?: string;
}

type TokenType = 
  | 'IDENTIFIER' | 'STRING' | 'NUMBER' | 'REGEX' 
  | 'OPERATOR' | 'DOT' | 'BRACKET_OPEN' | 'BRACKET_CLOSE' 
  | 'PAREN_OPEN' | 'PAREN_CLOSE' | 'AND' | 'OR' | 'COMMA' | 'EOF';

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
    if (char === ',') { tokens.push({ type: 'COMMA', value: ',', start: cursor, end: cursor + 1 }); cursor++; continue; }
    
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
           let endIdx = temp;
           let flags = '';
           while (endIdx < input.length && /[gimuy]/.test(input[endIdx])) {
               flags += input[endIdx];
               endIdx++;
           }
           // Store regex without the closing slash
           tokens.push({ type: 'REGEX', value: input.slice(cursor + 1, temp - 1), start: cursor, end: endIdx });
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
    
    let anyWordMatch = input.slice(cursor).match(/^[-a-zA-Z0-9_$@\u0080-\u{10FFFF}]+/u);
    if (anyWordMatch) {
       let val = anyWordMatch[0];
       let upper = val.toUpperCase();
       
       if (upper === 'AND') { tokens.push({ type: 'AND', value: val, start: cursor, end: cursor + val.length }); }
       else if (upper === 'OR') { tokens.push({ type: 'OR', value: val, start: cursor, end: cursor + val.length }); }
       else if (upper === 'IN') { tokens.push({ type: 'OPERATOR', value: 'IN', start: cursor, end: cursor + val.length }); }
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
  | { type: 'CompareExpr', path: PathAST, op: string, value: any, valueType: 'regex' | 'string' | 'number' | 'boolean' | 'array' }
  | { type: 'FuzzyMatchExpr', value: string }
  | { type: 'ExactMatchExpr', value: string }
  | { type: 'GroupExpr', expr: Expr };

export type PathNode = 
  | { type: 'property', key: string }
  | { type: 'property-regex', regex: string }
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
      if (!isAtEnd()) {
          throw new Error(`Unexpected token '${peek().value || peek().type}'`);
      }
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
      
      if (t.type === 'BRACKET_OPEN') {
           advance();
           let arr: any[] = [];
           while (peek().type !== 'BRACKET_CLOSE' && peek().type !== 'EOF') {
               let valTok = advance();
               if (valTok.type === 'STRING') arr.push(valTok.value);
               else if (valTok.type === 'NUMBER') arr.push(Number(valTok.value));
               else if (valTok.value === 'true') arr.push(true);
               else if (valTok.value === 'false') arr.push(false);
               else arr.push(valTok.value);
               
               if (peek().type === 'COMMA') advance();
           }
           if (peek().type === 'BRACKET_CLOSE') advance();
           
           let next = peek();
           if (next.type === 'OPERATOR' && next.value.toUpperCase() === 'IN') {
               advance();
               if (peek().type === 'IDENTIFIER') {
                   let path = parsePath();
                   return { type: 'CompareExpr', path, op: 'IN_REVERSE', value: arr, valueType: 'array' };
               } else {
                   throw new Error("Expected path after 'IN'");
               }
           }
           throw new Error("Expected 'IN <path>' after array literal");
      }
      
      if (t.type === 'STRING') {
          advance();
          let next = peek();
          if (next.type === 'OPERATOR' && next.value.toUpperCase() === 'IN') {
              advance();
              if (peek().type === 'IDENTIFIER') {
                  let path = parsePath();
                  return { type: 'CompareExpr', path, op: 'IN_REVERSE', value: [t.value], valueType: 'array' };
              } else {
                  throw new Error("Expected path after 'IN'");
              }
          }
          let exactPath: PathAST = [{ type: 'property', key: t.value }];
          return {
              type: 'LogicalExpr', 
              op: 'OR', 
              left: { type: 'ExactMatchExpr', value: t.value }, 
              right: { type: 'CompareExpr', path: exactPath, op: 'EXISTS', value: true, valueType: 'boolean' }
          };
      }
      
      if (t.type === 'REGEX') {
          advance();
          let next = peek();
          if (next.type === 'OPERATOR' && next.value.toUpperCase() === 'IN') {
              advance();
              if (peek().type === 'IDENTIFIER') {
                  let path = parsePath();
                  return { type: 'CompareExpr', path, op: 'IN_REVERSE', value: t.value, valueType: 'regex' };
              } else {
                  throw new Error("Expected path after 'IN'");
              }
          }
          throw new Error("Expected 'IN <path>' after regex literal");
      }
      
      if (t.type === 'IDENTIFIER') {
          let path = parsePath();
          let next = peek();
          
          if (next.type === 'OPERATOR') {
             advance();
             let op = next.value;
             let val: any;
             let valType: any;
             
             if (peek().type === 'BRACKET_OPEN') {
                 advance();
                 let arr: any[] = [];
                 while (peek().type !== 'BRACKET_CLOSE' && peek().type !== 'EOF') {
                     let valTok = advance();
                     if (valTok.type === 'STRING') arr.push(valTok.value);
                     else if (valTok.type === 'NUMBER') arr.push(Number(valTok.value));
                     else if (valTok.value === 'true') arr.push(true);
                     else if (valTok.value === 'false') arr.push(false);
                     else arr.push(valTok.value);
                     
                     if (peek().type === 'COMMA') advance();
                 }
                 if (peek().type === 'BRACKET_CLOSE') advance();
                 val = arr;
                 valType = 'array';
             } else {
                 let rightToken = advance();
                 if (rightToken.type === 'EOF') {
                     throw new Error(`Expected value after operator '${op}'`);
                 }
                 
                 val = rightToken.value;
                 valType = 'string';
                 
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
             }
             
             return { type: 'CompareExpr', path, op, value: val, valueType: valType };
          }
          
          if (path.length > 1 || path.some(p => p.type !== 'property')) {
              return { type: 'CompareExpr', path, op: 'EXISTS', value: true, valueType: 'boolean' };
          }
          
          return {
              type: 'LogicalExpr', 
              op: 'OR', 
              left: { type: 'FuzzyMatchExpr', value: pathToString(path) }, 
              right: { type: 'CompareExpr', path, op: 'EXISTS', value: true, valueType: 'boolean' }
          };
      }
      
      let tok = advance();
      if (tok.type === 'EOF') return { type: 'FuzzyMatchExpr', value: '' };
      return { type: 'FuzzyMatchExpr', value: tok.value };
  }
  
  function parsePath(): PathAST {
      let path: PathAST = [];
      
      function consumePathNode(tok: Token) {
          if (tok.value === 'name' && !isAtEnd() && peek().type === 'OPERATOR' && peek().value === '/=') {
              advance(); // consume /=
              let patTok = advance();
              if (patTok && (patTok.type === 'STRING' || patTok.type === 'REGEX')) {
                  path.push({ type: 'property-regex', regex: patTok.value });
                  return;
              }
              throw new Error("Expected string/regex after '/='");
          }
          path.push({ type: 'property', key: tok.value });
      }

      let tok = advance();
      consumePathNode(tok);
      
      while (!isAtEnd()) {
          if (peek().type === 'DOT') {
              advance();
              if (peek().type === 'IDENTIFIER') {
                  consumePathNode(advance());
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
        } else if (p.type === 'property-regex') {
            s += (i > 0 ? '.' : '') + `name/="${p.regex}"`;
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
    node: rawNode.rawValue !== undefined ? rawNode.rawValue : rawNode.value,
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
    
    let matchedPaths: string[] = [];
    if (isMatch) {
       matchedPaths = matchedResults.map(r => {
           let absPath = r.path;
           if (absPath) {
               if (absPath.startsWith('[')) {
                   return ctx.meta.path + absPath;
               } else {
                   return ctx.meta.path + (ctx.meta.path ? '.' : '') + absPath;
               }
           } else {
               return ctx.meta.path;
           }
       });
       // Deduplicate
       matchedPaths = Array.from(new Set(matchedPaths));
    }
    
    return {
        isMatch,
        matchedPaths,
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

export function evalInternal(expr: Expr, ctx: QueryContext): TraversalResult[] {
    if (expr.type === 'GroupExpr') {
        return evalInternal(expr.expr, ctx);
    }
    
    if (expr.type === 'LogicalExpr') {
        if (expr.op === 'AND') {
            const leftResults = evalInternal(expr.left, ctx);
            const rightResults = evalInternal(expr.right, ctx);
            
            const unionKept: TraversalResult[] = [];
            for (const l of leftResults) {
                for (const r of rightResults) {
                    if (areScopesCompatible(l.scopeId, r.scopeId)) {
                        // Keep the more specific one, or both if same
                        const lLen = l.scopeId.split('.').length;
                        const rLen = r.scopeId.split('.').length;
                        if (lLen > rLen) {
                            unionKept.push(l);
                        } else if (rLen > lLen) {
                            unionKept.push(r);
                        } else {
                            unionKept.push(l);
                            unionKept.push(r);
                        }
                    }
                }
            }
            
            // deduplicate
            const seen = new Set<string>();
            const result: TraversalResult[] = [];
            for (const item of unionKept) {
                const itemKey = `${item.scopeId}:${item.path}`;
                if (!seen.has(itemKey)) {
                    seen.add(itemKey);
                    result.push(item);
                }
            }
            return result;
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
                    path: '', // highlights the node itself
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
                   path: '', // highlights the node itself
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
                   path: '', // highlights the node itself
                   parent: null,
                   key: null,
                   arrayIndex: null,
                   source: ctx.node,
                   scopeId: 'root',
                   nodeType: 'primitive'
               });
           }
        }
        
        let metaPathClean = (ctx.meta.path || '').replace(/\[\d+\]/g, '');
        let qClean = query.replace(/\[\]/g, '');
        if (metaPathClean.toLowerCase().includes(qClean)) {
               results.push({
                   value: ctx.node,
                   path: '',
                   parent: null,
                   key: null,
                   arrayIndex: null,
                   source: ctx.node,
                   scopeId: 'root',
                   nodeType: typeof ctx.node === 'object' ? (Array.isArray(ctx.node) ? 'array' : 'object') : 'primitive'
               });
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
    
    if (expr.type === 'ExactMatchExpr') {
        const query = expr.value.toLowerCase();
        const results: TraversalResult[] = [];
        
        // Match exact strings in meta
        for (const [key, value] of Object.entries(ctx.meta)) {
            if (String(value).toLowerCase() === query) {
                results.push({
                    value,
                    path: '',
                    parent: ctx.meta,
                    key,
                    arrayIndex: null,
                    source: ctx.node,
                    scopeId: 'root',
                    nodeType: 'primitive'
                });
            }
        }
        
        if (typeof ctx.node === 'string') {
           if (ctx.node.toLowerCase() === query) {
               results.push({
                   value: ctx.node,
                   path: '',
                   parent: null,
                   key: null,
                   arrayIndex: null,
                   source: ctx.node,
                   scopeId: 'root',
                   nodeType: 'primitive'
               });
           }
        } else if (typeof ctx.node === 'number') {
           if (String(ctx.node) === query) {
               results.push({
                   value: ctx.node,
                   path: '',
                   parent: null,
                   key: null,
                   arrayIndex: null,
                   source: ctx.node,
                   scopeId: 'root',
                   nodeType: 'primitive'
               });
           }
        }
        
        let metaPathClean = (ctx.meta.path || '').replace(/\[\d+\]/g, '');
        let qClean = query.replace(/\[\]/g, '');
        if (metaPathClean.toLowerCase() === qClean) {
               results.push({
                   value: ctx.node,
                   path: '',
                   parent: null,
                   key: null,
                   arrayIndex: null,
                   source: ctx.node,
                   scopeId: 'root',
                   nodeType: typeof ctx.node === 'object' ? (Array.isArray(ctx.node) ? 'array' : 'object') : 'primitive'
               });
        } else if (typeof ctx.node === 'object' && ctx.node !== null) {
           for (const [k, v] of Object.entries(ctx.node)) {
                if (v === null || v === undefined) continue;
                if (typeof v === 'string') {
                    if (v.toLowerCase() === query) {
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
                    if (String(v) === query) {
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
            resolved.push({
                value: actual,
                path: '', // highlights the node itself
                parent: ctx.meta,
                key: firstKey,
                arrayIndex: null,
                source: ctx.node,
                scopeId: 'root',
                nodeType: 'primitive'
            });
        }
        
        // Always try to traverse the actual node data as well, so real payload fields like "id" or "name" are matched.
        resolved.push(...traversePath(ctx.node, expr.path, ctx.mode, ctx));
        
        let op = expr.op;
        let cValue = expr.value;
        
        const matched: TraversalResult[] = [];
        
        for (const res of resolved) {
            if ((op.toUpperCase() === 'IN_REVERSE' || op.toUpperCase() === 'IN') && (expr.valueType === 'array' || expr.valueType === 'regex') && Array.isArray(res.value)) {
                // Return the specific array elements that matched, rather than the parent array node
                const cArray = expr.valueType === 'array' ? (Array.isArray(cValue) ? cValue : [cValue]) : null;
                let regexExpr: RegExp | null = null;
                if (expr.valueType === 'regex') {
                    try { regexExpr = new RegExp(cValue, 'i'); } catch {}
                }
                
                for (let i = 0; i < res.value.length; i++) {
                    let itemMatch = false;
                    const val = res.value[i];
                    
                    if (expr.valueType === 'regex' && regexExpr) {
                        itemMatch = regexExpr.test(String(val));
                    } else if (cArray) {
                        if (typeof val === 'string') {
                            let normRes = normalizeSemantic(val);
                            itemMatch = cArray.some(c => typeof c === 'string' && normRes.includes(normalizeSemantic(c)));
                        }
                        if (!itemMatch) {
                            itemMatch = cArray.includes(val);
                        }
                    }
                    
                    if (itemMatch) {
                        matched.push({
                            value: val,
                            path: res.path ? `${res.path}[${i}]` : `[${i}]`,
                            parent: res.value,
                            key: null,
                            arrayIndex: i,
                            source: ctx.node,
                            scopeId: res.scopeId ? `${res.scopeId}.${i}` : `${i}`,
                            nodeType: typeof val === 'object' && val !== null ? (Array.isArray(val) ? 'array' : 'object') : 'primitive'
                        });
                    }
                }
            } else {
                if (compareValues(res.value, op, cValue, expr.valueType)) {
                    matched.push(res);
                }
            }
        }
        
        return matched;
    }
    
    return [];
}

function normalizeSemantic(val: any): string {
    if (val === null || val === undefined) return '';
    return String(val).trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareValues(actual: any, op: string, cValue: any, cType: 'string'|'number'|'boolean'|'regex'|'array'): boolean {
    if (op.toUpperCase() === 'IN_REVERSE' && cType === 'regex') {
        try {
            const regex = new RegExp(cValue, 'i');
            if (Array.isArray(actual)) {
                return actual.some(a => regex.test(String(a)));
            }
            return regex.test(String(actual));
        } catch {
            return false;
        }
    }
    
    if (op.toUpperCase() === 'IN_REVERSE' && cType === 'array') {
        // e.g., ["Media Preview", "Other"] IN features
        // This means we are checking if actual exists in our cValue array.
        // Or if actual is an array itself, any overlap between actual array and cValue array.
        const cArray = Array.isArray(cValue) ? cValue : [cValue];
        if (Array.isArray(actual)) {
            return cArray.some(item => {
                if (typeof item === 'string') {
                    return actual.some(a => typeof a === 'string' && normalizeSemantic(a).includes(normalizeSemantic(item)));
                }
                return actual.includes(item);
            });
        }
        if (typeof actual === 'string') {
            const normActual = normalizeSemantic(actual);
            return cArray.some(item => {
                if (typeof item === 'string') {
                    return normActual.includes(normalizeSemantic(item));
                }
                return false;
            });
        }
        return cArray.includes(actual);
    }
    
    if (op.toUpperCase() === 'IN') {
        if (cType === 'regex') {
            try {
                const regex = new RegExp(cValue, 'i');
                if (Array.isArray(actual)) {
                    return actual.some(a => regex.test(String(a)));
                }
                return regex.test(String(actual));
            } catch {
                return false;
            }
        }
        
        // path IN [val1, val2]
        if (cType === 'array') {
             const cArray = Array.isArray(cValue) ? cValue : [cValue];
             if (Array.isArray(actual)) {
                 return cArray.some((item: any) => actual.includes(item));
             }
             return cArray.includes(actual);
        } else {
             // fallback for string containment if used strangely
             return Array.isArray(actual) ? actual.includes(cValue) : false;
        }
    }
    
    if (op === 'EXISTS') {
        return actual !== undefined;
    }
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

export function traversePath(node: any, path: PathAST, mode: 'strict' | 'permissive', ctx: QueryContext): TraversalResult[] {
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
                // By user request, features.om should implicitly search into arrays like features[].om
                // So we always allow diving into arrays for property lookup
                let results: TraversalResult[] = [];
                for (let i=0; i < current.length; i++) {
                     let nextScope = currentScopeId ? `${currentScopeId}.${i}` : `${i}`;
                     results.push(...dig(current[i], pIdx, `${currentPath}[${i}]`, nextScope, current, null, i));
                }
                return results;
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
        else if (pNode.type === 'property-regex') {
            if (Array.isArray(current) || typeof current !== 'object') {
                return [];
            }
            let results: TraversalResult[] = [];
            try {
                let regex = new RegExp(pNode.regex, 'i');
                for (let key in current) {
                    if (regex.test(key)) {
                        let nextPath = currentPath ? `${currentPath}.${key}` : key;
                        results.push(...dig(current[key], pIdx + 1, nextPath, currentScopeId, current, key, null));
                    }
                }
            } catch (e) {
                // Invalid regex, just ignore and return empty results
            }
            return results;
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
            let targetIndex = pNode.index < 0 ? current.length + pNode.index : pNode.index;
            if (targetIndex < 0 || targetIndex >= current.length) return [];
            return dig(current[targetIndex], pIdx + 1, `${currentPath}[${targetIndex}]`, currentScopeId, current, null, targetIndex);
        }
        
        return [];
    }
    
    return dig(node, 0, "", "", null, null, null);
}
