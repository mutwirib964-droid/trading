/**
 * API route resolution helper for NetacoinFX full-stack and static deployments.
 * If VITE_API_URL is configured (e.g., when hosted on a static provider like Netlify),
 * all /api calls are routed to the specified server-side endpoint.
 * Otherwise, it defaults to relative routing on the current host.
 */
export const getApiUrl = (path: string): string => {
  const relativePath = path.startsWith('/') ? path : `/${path}`;
  
  // Clean potential public URL from environment variable
  const configuredUrl = import.meta.env.VITE_API_URL;
  if (configuredUrl) {
    const cleanBase = configuredUrl.replace(/\/+$/, '');
    return `${cleanBase}${relativePath}`;
  }
  
  // Default to relative paths for full-stack containers
  return relativePath;
};
