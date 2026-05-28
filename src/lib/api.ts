/**
 * API route resolution helper for NetacoinFX full-stack and static deployments.
 * If VITE_API_URL is configured (e.g., when hosted on a static provider like Netlify),
 * all /api calls are routed to the specified server-side endpoint.
 * Otherwise, it defaults to relative routing on the current host.
 */
export const getApiUrl = (path: string): string => {
  const relativePath = path.startsWith('/') ? path : `/${path}`;
  
  // If we are running on a static deploy provider like Netlify, custom domains, etc.
  // (which is not localhost/127.0.0.1 and not the AI Studio Cloud Run preview),
  // we MUST default to relative routing because Netlify functions serve the api on the same domain.
  // This prevents any CORS preflight redirect errors with public sandbox proxies.
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1') && !host.includes('run.app')) {
      return relativePath;
    }
  }
  
  // Clean potential public URL from environment variable
  const configuredUrl = import.meta.env.VITE_API_URL;
  if (configuredUrl) {
    const cleanBase = configuredUrl.replace(/\/+$/, '');
    return `${cleanBase}${relativePath}`;
  }
  
  // Default to relative paths for full-stack containers
  return relativePath;
};
