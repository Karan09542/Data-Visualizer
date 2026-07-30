export interface AITransportRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
}

export interface AITransportResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export abstract class AITransport {
  /**
   * Executes a standard REST request.
   */
  abstract request<T = any>(
    req: AITransportRequest
  ): Promise<AITransportResponse<T>>;

  /**
   * Executes a streaming request (e.g. SSE).
   */
  abstract stream(
    req: AITransportRequest
  ): Promise<void>;
}
