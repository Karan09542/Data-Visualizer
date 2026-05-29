import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function isProbableCsv(text: string): boolean {
  if (typeof text !== 'string') return false;
  if (!text.includes(',')) return false;
  
  const lines = text.trim().split('\n');
  if (lines.length < 2) return false;

  const result = Papa.parse(text.trim(), { header: false, preview: 10, skipEmptyLines: true });
  if (!result.data || result.data.length < 2) return false;
  
  const numColumns = (result.data[0] as any[]).length;
  if (numColumns < 2) return false;

  for (let i = 1; i < result.data.length; i++) {
    const rowLen = (result.data[i] as any[]).length;
    // Allow slight variation, but if completely different it might be regular text with commas
    if (Math.abs(rowLen - numColumns) > 1) {
      return false;
    }
  }

  return true;
}

export function parseCsv(text: string): any[] {
  const result = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  return result.data;
}

export function parseExcel(arrayBuffer: ArrayBuffer): Record<string, any[]> {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  
  const result: Record<string, any[]> = {};
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    result[sheetName] = XLSX.utils.sheet_to_json(sheet);
  }
  
  return result;
}

export function detectType(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'string') {
    if (val.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return 'uuid';
    if (val.match(/^https?:\/\//)) return 'url';
    if (val.includes('@') && val.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'email';
    if (val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) || (!isNaN(Date.parse(val)) && val.length > 8 && val.match(/[a-z]/i))) {
      return 'date';
    }
    if (val.match(/^\+?[\d\s-]{10,20}$/)) return 'phone';
    if (val.match(/^[$€£¥₹]\s*\d+(?:,\d+)*(?:\.\d+)?$/)) return 'currency';
  }
  return typeof val;
}

export function generateSchemaFromData(data: any[]): any {
  if (!data || data.length === 0) return {};
  
  const schema: Record<string, { type: string, confidence: number }> = {};
  
  const sampleSize = Math.min(data.length, 100);
  
  for (let i = 0; i < sampleSize; i++) {
    const row = data[i];
    if (!row || typeof row !== 'object') continue;
    
    for (const key of Object.keys(row)) {
      if (!schema[key]) {
        schema[key] = { type: 'string', confidence: 0 };
      }
      
      const valType = detectType(row[key]);
      
      // Basic voting logic could go here, but for simplicity we'll just track the last non-null type or default to string
      if (valType !== 'null' && valType !== 'string' || schema[key].type === 'string') {
        schema[key].type = valType !== 'null' ? valType : schema[key].type;
      }
    }
  }
  
  // Condense to simple type map
  const finalSchema: Record<string, string> = {};
  for (const key of Object.keys(schema)) {
    finalSchema[key] = schema[key].type;
  }
  
  return finalSchema;
}
