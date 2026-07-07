export class LRUCache<K, V> {
  private map = new Map<K, V>();
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, value: V) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }
    this.map.set(key, value);
  }

  delete(key: K) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

export class Registry {
  // LRU for parsed ASTs
  private parsedRegistry = new LRUCache<string, any>(1000);
  
  // LRU for compiled Expressions
  private compiledRegistry = new LRUCache<string, any>(1000);

  // O(1) mapping from Expression -> Compiled Key
  private expressionToKey = new LRUCache<string, string>(1000);

  private nextCompiledKey = 0;

  getParsedNode(expr: string): any | undefined {
    return this.parsedRegistry.get(expr);
  }

  setParsedNode(expr: string, node: any) {
    this.parsedRegistry.set(expr, node);
  }

  getCompiled(key: string): any | undefined {
    return this.compiledRegistry.get(key);
  }

  getCompiledKey(expr: string): string | undefined {
    return this.expressionToKey.get(expr);
  }

  registerCompiled(expr: string, compiled: any): string {
    const key = `ck_${this.nextCompiledKey++}`;
    compiled.__expr = expr;
    this.compiledRegistry.set(key, compiled);
    this.expressionToKey.set(expr, key);
    return key;
  }

  deleteCompiled(key: string) {
    const compiled = this.compiledRegistry.get(key);
    if (compiled && compiled.__expr) {
      this.expressionToKey.delete(compiled.__expr);
    }
    this.compiledRegistry.delete(key);
  }

  clear() {
    this.parsedRegistry.clear();
    this.compiledRegistry.clear();
    this.expressionToKey.clear();
    this.nextCompiledKey = 0;
  }
}
