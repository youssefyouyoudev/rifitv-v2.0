import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createGatewayServer, looksLikeMpegTs } from "../src/server.ts";

test("detects MPEG-TS sync byte alignment", () => {
  const sample = Buffer.alloc(188 * 8, 0);
  for (let packet = 0; packet < 8; packet++) {
    sample[packet * 188] = 0x47;
  }

  assert.equal(looksLikeMpegTs(sample), true);
  assert.equal(looksLikeMpegTs(Buffer.from("<html>Bad Gateway</html>")), false);
});

test("rejects HTML upstream before committing media headers", async () => {
  const upstream = await serve((_, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html>Bad Gateway</html>");
  });
  const backend = await tokenBackend({ url: upstream.url, protocol: "mpegts" });
  const gateway = await gatewayServer(backend.url);

  const response = await fetch(`${gateway.url}/media/live/token`);
  const body = await response.text();

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("content-type")?.startsWith("text/plain"), true);
  assert.equal(body.includes("<html>"), false);

  await closeAll(upstream, backend, gateway);
});

test("follows redirects and passes valid MPEG-TS bytes", async () => {
  const ts = tsSample();
  const media = await serve((_, res) => {
    res.writeHead(200, { "content-type": "video/mp2t" });
    res.end(ts);
  });
  const redirect = await serve((_, res) => {
    res.writeHead(302, { location: media.url });
    res.end();
  });
  const backend = await tokenBackend({ url: redirect.url, protocol: "mpegts" });
  const gateway = await gatewayServer(backend.url);

  const response = await fetch(`${gateway.url}/media/live/token`);
  const body = Buffer.from(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp2t");
  assert.equal(body[0], 0x47);

  await closeAll(media, redirect, backend, gateway);
});

test("mid-stream upstream failure does not inject textual gateway errors", async () => {
  const upstream = await serve((_, res) => {
    res.writeHead(200, { "content-type": "video/mp2t" });
    res.write(tsSample());
    res.socket?.destroy();
  });
  const backend = await tokenBackend({ url: upstream.url, protocol: "mpegts" });
  const gateway = await gatewayServer(backend.url);

  let body = Buffer.alloc(0);
  try {
    const response = await fetch(`${gateway.url}/media/live/token`);
    body = Buffer.from(await response.arrayBuffer());
  } catch {
    body = Buffer.alloc(0);
  }

  const text = body.toString("utf8");
  assert.equal(text.includes("Bad Gateway"), false);
  assert.equal(text.includes("<html"), false);

  await closeAll(upstream, backend, gateway);
});

function tsSample() {
  const sample = Buffer.alloc(188 * 10, 0);
  for (let packet = 0; packet < 10; packet++) {
    sample[packet * 188] = 0x47;
  }

  return sample;
}

async function tokenBackend(source) {
  return serve((req, res) => {
    assert.equal(req.headers["x-rifitv-gateway-secret"], "secret");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: source }));
  });
}

async function gatewayServer(backendUrl) {
  return listen(createGatewayServer({ backend: backendUrl, secret: "secret", requestTimeoutMs: 5000 }));
}

async function serve(handler) {
  return listen(http.createServer(handler));
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function closeAll(...servers) {
  await Promise.all(servers.map(({ server }) => new Promise((resolve) => server.close(resolve))));
}
