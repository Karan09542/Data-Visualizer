export function getProxiedUrl(originalUrl: string): string {
  if (!originalUrl || originalUrl.startsWith('data:') || originalUrl.startsWith('blob:') || originalUrl.includes('go.data-visualizer.workers.dev')) {
    return originalUrl;
  }
  return `https://go.data-visualizer.workers.dev/?url=${encodeURIComponent(originalUrl)}`;
}
