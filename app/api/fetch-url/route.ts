import { PDFParse } from "pdf-parse";
import { checkOrigin, checkRateLimit } from "@/app/lib/http";
import { isBlockedHost, resolvesToPrivateAddress } from "@/app/lib/net";

export const runtime = "nodejs";

// Fetching plus PDF text extraction on a large document can exceed Vercel's
// default 10s function timeout.
export const maxDuration = 60;

const FETCH_TIMEOUT_MS = 20_000;

/**
 * Hard cap on the response body we will buffer. The client caps *uploads* at
 * 5MB, but a URL fetch had no cap at all — a multi-hundred-megabyte PDF would
 * be read fully into memory and take down the function.
 */
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB

/** Only the first 12,000 chars are ever used downstream (SPEC 4.1). */
const MIN_EXTRACTED_CHARS = 200;

const RATE_LIMIT = { name: "fetch-url", limit: 20, windowMs: 60_000 };

/**
 * Strip HTML to readable plain text. Removes script/style/noscript blocks,
 * drops all remaining tags, and decodes the most common entities.
 */
function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const text = withoutBlocks
    .replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Decode a numeric character reference, ignoring out-of-range code points. */
function decodeCodePoint(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return "";
  // Lone surrogates are not valid scalar values and throw in fromCodePoint.
  if (value >= 0xd800 && value <= 0xdfff) return "";
  return String.fromCodePoint(value);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => decodeCodePoint(Number(n)))
    // Hex references (&#x27;) were previously left as literal text.
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h: string) =>
      decodeCodePoint(parseInt(h, 16)),
    )
    // &amp; must be decoded last, so "&amp;lt;" yields "&lt;" and not "<".
    .replace(/&amp;/g, "&");
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return decodeEntities(match[1]).replace(/\s+/g, " ").trim();
}

/**
 * Read a response body with a hard byte ceiling.
 *
 * `res.arrayBuffer()` buffers the entire body regardless of size and ignores a
 * lying or absent Content-Length, so the stream is read incrementally and
 * aborted the moment it exceeds the cap.
 */
async function readCapped(res: Response): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;

  if (!res.body) return null;

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Extract text from a PDF, always releasing the parser's worker resources. */
async function extractPdfText(data: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    // pdf-parse v2 holds a pdf.js document (and in Node a worker) open until
    // destroy() is called. Omitting it leaked one per request.
    await parser.destroy().catch(() => {});
  }
}

export async function POST(req: Request) {
  const originError = checkOrigin(req);
  if (originError) return originError;

  const rateError = checkRateLimit(req, RATE_LIMIT);
  if (rateError) return rateError;

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const url = (typeof body?.url === "string" ? body.url : "").trim();
  if (!url) {
    return Response.json({ error: "No URL provided." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    return Response.json(
      { error: "Could not access this URL. Try downloading the PDF directly." },
      { status: 400 },
    );
  }

  // SSRF guard. This route makes the server fetch an arbitrary caller-supplied
  // URL and returns the body, which without this check turns it into a proxy
  // into the private network — cloud metadata (169.254.169.254), localhost
  // admin panels, internal services. Blocked by literal address and, for
  // hostnames, by resolving them first.
  if (isBlockedHost(parsedUrl.hostname)) {
    return Response.json(
      { error: "Could not access this URL. Try downloading the PDF directly." },
      { status: 400 },
    );
  }
  if (await resolvesToPrivateAddress(parsedUrl.hostname)) {
    return Response.json(
      { error: "Could not access this URL. Try downloading the PDF directly." },
      { status: 400 },
    );
  }

  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    res = await fetch(parsedUrl, {
      signal: controller.signal,
      // "follow" would let a permitted host redirect to a private address,
      // stepping around the checks above. Redirects are resolved manually so
      // each hop is re-validated.
      redirect: "manual",
      headers: { "User-Agent": "Paper-to-Human/1.0 (research tool)" },
    });

    let hops = 0;
    while (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (++hops > 5) {
        return Response.json(
          {
            error:
              "Could not access this URL. Try downloading the PDF directly.",
          },
          { status: 502 },
        );
      }
      const next = new URL(res.headers.get("location")!, parsedUrl);
      if (
        (next.protocol !== "http:" && next.protocol !== "https:") ||
        isBlockedHost(next.hostname) ||
        (await resolvesToPrivateAddress(next.hostname))
      ) {
        return Response.json(
          {
            error:
              "Could not access this URL. Try downloading the PDF directly.",
          },
          { status: 400 },
        );
      }
      parsedUrl = next;
      res = await fetch(next, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "Paper-to-Human/1.0 (research tool)" },
      });
    }
  } catch (err) {
    console.error("URL fetch error:", err);
    const timedOut = err instanceof Error && err.name === "AbortError";
    return Response.json(
      {
        error: timedOut
          ? "This URL took too long to respond. Try downloading the PDF directly."
          : "Could not access this URL. Try downloading the PDF directly.",
      },
      { status: timedOut ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return Response.json(
      { error: "Could not access this URL. Try downloading the PDF directly." },
      { status: 502 },
    );
  }

  const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
  const isPdf =
    contentType.includes("application/pdf") ||
    parsedUrl.pathname.toLowerCase().endsWith(".pdf");

  let text: string;
  let title: string;

  try {
    const buffer = await readCapped(res);
    if (!buffer) {
      return Response.json(
        {
          error:
            "This file is too large to process. Try downloading the PDF and uploading it directly.",
        },
        { status: 413 },
      );
    }

    if (isPdf) {
      text = await extractPdfText(buffer);
      title = parsedUrl.pathname.split("/").pop() || parsedUrl.hostname;
    } else {
      const html = new TextDecoder("utf-8").decode(buffer);
      text = htmlToText(html);
      title = extractTitle(html) || parsedUrl.hostname;
    }
  } catch (err) {
    console.error("URL extraction error:", err);
    return Response.json(
      {
        error: isPdf
          ? "Could not extract text from this PDF. Try copying the text manually."
          : "Could not extract text from this page. Try copying the text manually.",
      },
      { status: 422 },
    );
  }

  // A scanned PDF (images, no text layer) parses successfully and yields an
  // empty string. Previously that was returned as a 200 with text: "", and the
  // user got "Not enough text to process. Please upload the full paper." from
  // the next route — which blames them for a file that simply has no text.
  if (text.length < MIN_EXTRACTED_CHARS) {
    return Response.json(
      {
        error: isPdf
          ? "This PDF has no selectable text (it may be a scan). Try copying the text manually."
          : "Could not extract enough text from this page. Try copying the text manually.",
      },
      { status: 422 },
    );
  }

  return Response.json({ text, title });
}
