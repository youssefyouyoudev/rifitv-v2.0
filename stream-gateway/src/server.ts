import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { request } from "node:http";
import { request as httpsRequest } from "node:https";
import { pipeline } from "node:stream";
import { URL } from "node:url";

const DEFAULT_PORT = Number(process.env.PORT ?? 8787);
const DEFAULT_BACKEND = process.env.RIFITV_BACKEND_URL ?? process.env.LARAVEL_BASE_URL ?? "http://127.0.0.1:8000";
const DEFAULT_SECRET = process.env.RIFITV_GATEWAY_SECRET ?? process.env.GATEWAY_INTERNAL_SECRET ?? "";

type ResolvedSource = {
  url: string;
  protocol: "hls" | "mpegts";
};

type GatewayConfig = {
  backend: string;
  secret: string;
  maxRedirects: number;
  startupSampleBytes: number;
  requestTimeoutMs: number;
};

const defaultConfig: GatewayConfig = {
  backend: DEFAULT_BACKEND,
  secret: DEFAULT_SECRET,
  maxRedirects: 4,
  startupSampleBytes: 188 * 8,
  requestTimeoutMs: 300_000,
};

export function createGatewayServer(config: Partial<GatewayConfig> = {}) {
  const gatewayConfig = { ...defaultConfig, ...config };

  return http.createServer(async (req, res) => {
    if (req.url === "/health") {
      writeText(res, 200, JSON.stringify({ ok: true }), "application/json");
      return;
    }

    const match = req.url?.match(/^\/media\/live\/([A-Za-z0-9]+)$/);
    if (!match) {
      writeText(res, 404, "");
      return;
    }

    if (!gatewayConfig.secret) {
      writeText(res, 503, "gateway not configured");
      return;
    }

    try {
      const token = match[1];
      const resolved = await resolveToken(token, gatewayConfig);
      const upstreamUrl = new URL(resolved.url);
      if (!["http:", "https:"].includes(upstreamUrl.protocol)) {
        writeText(res, 403, "");
        return;
      }

      await streamResolvedSource(res, resolved, gatewayConfig);
    } catch {
      if (res.headersSent) {
        res.destroy();
        return;
      }

      writeText(res, 403, "");
    }
  });
}

export async function streamResolvedSource(res: ServerResponse, resolved: ResolvedSource, config: GatewayConfig = defaultConfig): Promise<void> {
  const upstream = await openUpstream(new URL(resolved.url), config);

  if (!upstream.statusCode || upstream.statusCode < 200 || upstream.statusCode >= 300) {
    destroyUpstream(upstream);
    writeText(res, 502, "Upstream stream unavailable.");
    return;
  }

  const contentType = String(upstream.headers["content-type"] ?? "");
  if (looksLikeTextErrorContent(contentType)) {
    destroyUpstream(upstream);
    writeText(res, 502, "Upstream returned non-media content.");
    return;
  }

  let startupSample: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  try {
    startupSample = await readStartupSample(upstream, config.startupSampleBytes);
  } catch {
    destroyUpstream(upstream);
    writeText(res, 502, "Upstream stream unavailable.");
    return;
  }

  if (resolved.protocol === "mpegts" && !looksLikeMpegTs(startupSample)) {
    destroyUpstream(upstream);
    writeText(res, 502, "Upstream returned invalid MPEG-TS.");
    return;
  }

  if (resolved.protocol === "hls" && !looksLikeHls(startupSample)) {
    destroyUpstream(upstream);
    writeText(res, 502, "Upstream returned invalid HLS.");
    return;
  }

  res.writeHead(200, mediaHeaders(resolved.protocol));

  if (startupSample.length > 0 && !res.write(startupSample)) {
    await onceDrain(res);
  }

  await new Promise<void>((resolve) => {
    pipeline(upstream, res, (error) => {
      if (error && res.headersSent) {
        res.destroy();
      }
      resolve();
    });
  });
}

async function openUpstream(url: URL, config: GatewayConfig, redirects = 0): Promise<IncomingMessage> {
  const response = await requestUpstream(url, config.requestTimeoutMs);

  if (isRedirect(response.statusCode) && response.headers.location && redirects < config.maxRedirects) {
    destroyUpstream(response);
    return openUpstream(new URL(response.headers.location, url), config, redirects + 1);
  }

  return response;
}

async function requestUpstream(url: URL, timeoutMs: number): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const upstreamRequest = (url.protocol === "https:" ? httpsRequest : request)(
      url,
      {
        headers: {
          accept: "*/*",
          "icy-metadata": "1",
          "user-agent": "VLC/3.0.20 LibVLC/3.0.20",
        },
        timeout: timeoutMs,
      },
      (upstream) => {
        resolve(upstream);
      },
    );

    upstreamRequest.on("timeout", () => upstreamRequest.destroy(new Error("upstream timeout")));
    upstreamRequest.on("error", reject);
    upstreamRequest.end();
  });
}

async function resolveToken(token: string, config: GatewayConfig): Promise<ResolvedSource> {
  const response = await fetch(`${config.backend}/api/media/tokens/${token}`, {
    headers: { "X-RiFiTV-Gateway-Secret": config.secret, accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("token rejected");
  }
  const payload = (await response.json()) as { data: ResolvedSource };
  return payload.data;
}

async function readStartupSample(upstream: IncomingMessage, targetBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("startup sample timeout"));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timer);
      upstream.off("data", onData);
      upstream.off("end", onEnd);
      upstream.off("error", onError);
    };

    const done = () => {
      cleanup();
      upstream.pause();
      resolve(Buffer.concat(chunks, bytes));
    };

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      bytes += chunk.length;

      if (bytes >= targetBytes) {
        done();
      }
    };
    const onEnd = () => done();
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    upstream.on("data", onData);
    upstream.once("end", onEnd);
    upstream.once("error", onError);
    upstream.resume();
  });
}

export function looksLikeMpegTs(sample: Buffer): boolean {
  if (sample.length < 188 * 5) {
    return false;
  }

  for (let offset = 0; offset < 188; offset++) {
    let matches = 0;
    for (let packet = 0; packet < 5; packet++) {
      if (sample[offset + packet * 188] === 0x47) {
        matches++;
      }
    }

    if (matches >= 5) {
      return true;
    }
  }

  return false;
}

export function looksLikeHls(sample: Buffer): boolean {
  const text = sample.toString("utf8", 0, Math.min(sample.length, 4096)).trimStart();
  return text.startsWith("#EXTM3U") && (text.includes("#EXT-X-") || text.includes("#EXTINF"));
}

function looksLikeTextErrorContent(contentType: string): boolean {
  return /(?:text\/html|application\/json|text\/plain|application\/xml|text\/xml)/i.test(contentType);
}

function mediaHeaders(protocol: ResolvedSource["protocol"]): http.OutgoingHttpHeaders {
  return {
    "content-type": protocol === "hls" ? "application/vnd.apple.mpegurl" : "video/mp2t",
    "cache-control": "no-store, no-cache",
    "x-accel-buffering": "no",
  };
}

function writeText(res: ServerResponse, statusCode: number, body: string, contentType = "text/plain"): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }

  res.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  res.end(body);
}

function destroyUpstream(upstream: IncomingMessage): void {
  upstream.destroy();
}

function isRedirect(statusCode?: number): boolean {
  return statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308;
}

async function onceDrain(res: ServerResponse): Promise<void> {
  await new Promise<void>((resolve) => res.once("drain", resolve));
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  createGatewayServer().listen(DEFAULT_PORT);
}
