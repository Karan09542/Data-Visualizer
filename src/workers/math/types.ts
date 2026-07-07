export interface MathWorkerRequest {
  id: number;
  action: string;
  payload: any;
}

export interface MathWorkerResponse {
  id: number;
  success: boolean;
  result?: any;
  error?: { message: string };
}

export interface MathWorkerHandler<T = any, R = any> {
  (payload: T, context: import("./context").MathWorkerContext): R;
}

export interface MathScope extends Record<string, unknown> {
  ln: (...args: any[]) => any;
  log10: (...args: any[]) => any;
  indexHelper: (obj: any, ...indices: any[]) => any;
}

