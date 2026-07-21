/**
 * Paper-to-Human — shared API-route guards.
 *
 * Origin allow-listing, basic rate limiting, and environment validation.
 * Used by both /api/translate and /api/fetch-url so the two routes cannot
 * drift apart.
 */

/** Origins always accepted while developing locally. */
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/**
 * Allowed browser origins.
 *
 * Production: exactly what `ALLOWED_ORIGIN` names (comma-separated for the
 * Vercel preview + custom-domain case). Development: localhost is added.
 *
 * Computed per call rather than at module load so a missing/late env var in a
 * serverless cold start is still picked up.
 */
function allowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return process.env.NODE_ENV === "production"
    ? configured
    : [...DEV_ORIGINS, ...configured];
}

/**
 * Reject cross-origin browser calls.
 *
 * Returns a 403 Response to short-circuit with, or `null` if the request may
 * proceed. Requests with no Origin header are allowed only when they are not
 * browser-initiated: a browser always sends Origin on a cross-origin
 * fetch/XHR, so `sec-fetch-site: same-origin` (or the header being absent
 * entirely, i.e. a non-browser client) is the safe case.
 *
 * NOTE: this is a same-origin guard, not authentication. It stops casual
 * embedding and drive-by use of the endpoint from other sites; it does not
 * stop a determined caller with curl, which can forge any header. The rate
 * limiter below is what bounds abuse from those.
 */
export function checkOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");

  if (origin) {
    const normalized = origin.replace(/\/$/, "");
    if (!allowedOrigins().includes(normalized)) {
      return Response.json({ error: "No autorizado." }, { status: 403 });
    }
    return null;
  }

  // No Origin header. Block if the browser tells us it was cross-site.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return Response.json({ error: "No autorizado." }, { status: 403 });
  }

  return null;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Drop expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Fixed-window rate limit, keyed by client IP.
 *
 * Returns a 429 Response to short-circuit with, or `null` to proceed.
 *
 * NOTE: state lives in the process, so on Vercel each serverless instance
 * enforces its own window — the effective limit is `limit × instances`. That
 * is enough to stop a single client hammering the endpoint (the common case
 * for a small study app) but is not a distributed quota. Move to Vercel KV or
 * Upstash if a hard global limit is ever required.
 */
export function checkRateLimit(
  req: Request,
  { name, limit, windowMs }: { name: string; limit: number; windowMs: number },
): Response | null {
  const now = Date.now();
  sweep(now);

  // Namespaced by route: both routes import this module, so an un-namespaced
  // key let cheap /api/fetch-url calls exhaust the stricter /api/translate
  // budget for the same client.
  const key = `${name}:${clientKey(req)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return Response.json(
      { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

/**
 * Report which of the named environment variables are missing.
 *
 * Called at module load in each route so a misconfigured deploy logs the
 * variable name once, at boot, instead of surfacing later as an opaque
 * "Translation failed" to the user. It logs rather than throws on purpose:
 * throwing at module scope would break `next build`, which evaluates route
 * modules in an environment where runtime secrets are not present.
 *
 * @returns the names that are unset, so the handler can also refuse cleanly.
 */
export function checkEnv(...names: string[]): string[] {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length > 0) {
    console.error(
      `[config] Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in .env.local (development) or the Vercel project settings (production).`,
    );
  }
  return missing;
}
