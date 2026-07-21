/**
 * Paper-to-Human — SSRF guards for /api/fetch-url.
 *
 * That route fetches a caller-supplied URL server-side and returns the body.
 * Without these checks it is an open proxy into whatever the server can reach:
 * cloud instance metadata (169.254.169.254), localhost admin interfaces, and
 * anything else on the private network.
 */

import { lookup } from "node:dns/promises";
import net from "node:net";

/** Hostnames that are never legitimate targets for a public paper URL. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
]);

/** Suffixes reserved for internal/private naming. */
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

/** True for loopback, private, link-local, CGNAT, and other reserved IPv4. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // unparseable — refuse rather than guess
  }
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/** True for IPv6 loopback, unique-local, link-local, and mapped-private v4. */
function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];

  if (addr === "::" || addr === "::1") return true;

  // ::ffff:127.0.0.1 and friends — an IPv4 address wearing an IPv6 hat.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
  if (mapped) return isPrivateIPv4(mapped[1]);

  if (/^f[cd]/.test(addr)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(addr)) return true; // fe80::/10 link-local
  if (addr.startsWith("ff")) return true; // multicast
  return false;
}

/** True if the literal host is a private/reserved IP or a blocked name. */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  const kind = net.isIP(host);
  if (kind === 4) return isPrivateIPv4(host);
  if (kind === 6) return isPrivateIPv6(host);

  return false;
}

/**
 * Resolve a hostname and report whether any address it maps to is private.
 *
 * Catches DNS rebinding-style bypasses where a public-looking name resolves to
 * an internal address. A resolution failure is treated as blocked: the fetch
 * would fail anyway, and failing closed is the right default here.
 *
 * NOTE: this is a check-then-use pattern — the name is resolved again by
 * `fetch`, so a TTL-0 record could in principle return a different address the
 * second time. Closing that gap entirely requires pinning the resolved IP into
 * the connection (a custom agent/dispatcher), which is more machinery than
 * this app warrants; the check plus per-hop redirect validation covers the
 * realistic cases.
 */
export async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return false; // already checked by isBlockedHost

  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0) return true;
    return addresses.some(({ address, family }) =>
      family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address),
    );
  } catch {
    return true; // fail closed
  }
}
