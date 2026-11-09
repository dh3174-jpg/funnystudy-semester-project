const DEVELOPMENT_ORIGIN = "http://localhost:3000";

function webOrigin(value: string | undefined | null) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLoopback(origin: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
}

/** Forwarded headers come from the deployment proxy, not browser location state. */
export function getAuthRequestOrigin(request: Request) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0].trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
    ?? (host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ? "http" : "https");
  const forwarded = host && !/[\s/@?#\\]/.test(host) ? webOrigin(`${protocol}://${host}`) : null;
  const origin = forwarded ?? webOrigin(request.url);
  if (origin && (process.env.NODE_ENV !== "production" || !isLoopback(origin))) return origin;
  if (process.env.NODE_ENV !== "production") return DEVELOPMENT_ORIGIN;
  throw new Error("A public origin is required for production authentication.");
}

/** Both OAuth initiation and callback routing must resolve the same canonical origin. */
export function getAuthOrigin(request: Request) {
  return webOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? getAuthRequestOrigin(request);
}
