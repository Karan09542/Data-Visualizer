import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import { AITransport, AITransportRequest, AITransportResponse } from "./AITransport";

export class AxiosTransport extends AITransport {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL?: string) {
    super();
    this.baseURL = baseURL || "";
    this.client = axios.create({
      baseURL,
    });
  }

  private getFullUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    const base = this.baseURL.endsWith("/") ? this.baseURL.slice(0, -1) : this.baseURL;
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${base}${path}`;
  }

  async request<T = any>(req: AITransportRequest): Promise<AITransportResponse<T>> {
    const config: AxiosRequestConfig = {
      url: req.url,
      method: req.method || "GET",
      headers: req.headers,
      data: req.body,
      signal: req.signal,
    };

    try {
      const response: AxiosResponse<T> = await this.client.request(config);
      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        throw new Error("Request cancelled");
      }

      const axiosError = error as AxiosError;

      // Fallback: If network error/CORS error on absolute external URL, attempt proxy
      if (!axiosError.response && (axiosError.message === "Network Error" || axiosError.code === "ERR_NETWORK" || axiosError.code === "ERR_FAILED")) {
        const fullUrl = this.getFullUrl(req.url);
        if (fullUrl.startsWith("http")) {
          try {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(fullUrl)}`;
            const fallbackResponse = await axios.request({
              ...config,
              url: proxyUrl,
            });
            return {
              data: fallbackResponse.data,
              status: fallbackResponse.status,
              headers: fallbackResponse.headers as Record<string, string>,
            };
          } catch {
            // Fallthrough to standard error reporting
          }
        }
      }

      throw new Error(
        `Transport Error: ${axiosError.response?.status || 'Network Error'} - ${
          axiosError.response?.data ? JSON.stringify(axiosError.response.data) : axiosError.message
        }`
      );
    }
  }

  async stream(req: AITransportRequest): Promise<void> {
    if (!req.onChunk) {
      throw new Error("Streaming requires an onChunk callback");
    }

    const fullUrl = this.getFullUrl(req.url);

    try {
      let response: Response;
      try {
        response = await fetch(fullUrl, {
          method: req.method || "GET",
          headers: {
            ...req.headers,
            "Accept": "text/event-stream",
          },
          body: req.body ? JSON.stringify(req.body) : undefined,
          signal: req.signal,
        });
      } catch {
        // Retry via CORS Cloudflare proxy worker if direct/local fetch fails
        const targetUrl = fullUrl.startsWith("http")
          ? fullUrl
          : `https://integrate.api.nvidia.com/v1${req.url.startsWith('/') ? req.url : '/' + req.url}`;
        const proxyUrl = `https://go.data-visualizer.workers.dev/?url=${encodeURIComponent(targetUrl)}`;

        response = await fetch(proxyUrl, {
          method: req.method || "GET",
          headers: {
            ...req.headers,
            "Accept": "text/event-stream",
          },
          body: req.body ? JSON.stringify(req.body) : undefined,
          signal: req.signal,
        });
      }

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (typeof errorData?.detail === 'string') {
            errorMsg = errorData.detail;
          } else if (errorData?.detail?.message) {
            errorMsg = errorData.detail.message;
          } else if (errorData?.message) {
            errorMsg = errorData.message;
          } else if (errorData?.error?.message) {
            errorMsg = errorData.error.message;
          }
        } catch {
          // Fallback to default
        }
        throw new Error(errorMsg);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        req.onChunk(chunk);
      }
    } catch (error: any) {
       if (error.name === "AbortError") {
         throw new Error("Request cancelled");
       }
       throw error;
    }
  }
}
