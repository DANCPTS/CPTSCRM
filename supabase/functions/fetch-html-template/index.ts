import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

function isPrivateOrReserved(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0"
  ) {
    return true;
  }

  const parts = hostname.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const octets = parts.map(Number);
    // 10.x.x.x
    if (octets[0] === 10) return true;
    // 172.16-31.x.x
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.x.x
    if (octets[0] === 192 && octets[1] === 168) return true;
    // 169.254.x.x (link-local)
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 0.x.x.x
    if (octets[0] === 0) return true;
    // 100.64-127.x.x (CGN)
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return true;
    // 198.18-19.x.x (benchmark)
    if (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19))
      return true;
  }

  if (
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    return true;
  }

  return false;
}

function validateUrl(rawUrl: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only http and https URLs are allowed" };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with embedded credentials are not allowed" };
  }

  if (isPrivateOrReserved(parsed.hostname)) {
    return { valid: false, error: "URLs pointing to private or local addresses are not allowed" };
  }

  return { valid: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "A URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = validateUrl(url.trim());
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let currentUrl = url.trim();
    let response: Response;
    let redirectCount = 0;

    try {
      while (true) {
        response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: "manual",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; EmailTemplateImporter/1.0)",
            Accept: "text/html,application/xhtml+xml,*/*",
          },
        });

        if (
          response.status >= 300 &&
          response.status < 400 &&
          response.headers.get("location")
        ) {
          redirectCount++;
          if (redirectCount > MAX_REDIRECTS) {
            clearTimeout(timeoutId);
            return new Response(
              JSON.stringify({ success: false, error: "Too many redirects" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const redirectTarget = new URL(
            response.headers.get("location")!,
            currentUrl
          ).toString();
          const redirectValidation = validateUrl(redirectTarget);
          if (!redirectValidation.valid) {
            clearTimeout(timeoutId);
            return new Response(
              JSON.stringify({
                success: false,
                error: `Redirect blocked: ${redirectValidation.error}`,
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          currentUrl = redirectTarget;
          continue;
        }
        break;
      }
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      const msg =
        fetchErr instanceof DOMException && fetchErr.name === "AbortError"
          ? "Request timed out (15 seconds)"
          : `Failed to fetch URL: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`;
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    clearTimeout(timeoutId);

    if (!response!.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `The URL returned status ${response!.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = response!.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `The URL did not return HTML (received ${contentType.split(";")[0].trim() || "unknown"})`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentLength = response!.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "The page is too large (over 2 MB)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const buffer = await response!.arrayBuffer();
    if (buffer.byteLength > MAX_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "The page is too large (over 2 MB)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decoder = new TextDecoder("utf-8", { fatal: false });
    const html = decoder.decode(buffer);

    return new Response(
      JSON.stringify({ success: true, html, fetchedUrl: currentUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
