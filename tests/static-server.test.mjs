import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { dirname, resolve } from "node:path";
import test, { after, before, describe } from "node:test";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_PATH = resolve(ROOT, "scripts/serve.mjs");

function request({ port, path = "/", method = "GET", headers = {} }) {
  return new Promise((resolveRequest, rejectRequest) => {
    const outgoing = http.request({ hostname: "127.0.0.1", port, path, method, headers }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () => resolveRequest({
        status: incoming.statusCode,
        httpVersion: incoming.httpVersion,
        headers: incoming.headers,
        body: Buffer.concat(chunks),
      }));
    });
    outgoing.on("error", rejectRequest);
    outgoing.end();
  });
}

function startServer({ args = [], env = {} } = {}) {
  const child = spawn(process.execPath, [SERVER_PATH, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolveStart, rejectStart) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      rejectStart(new Error(`server startup timed out\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 5_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const match = stdout.match(/Serving GreenWorth at http:\/\/[^:]+:(\d+)\//);
      if (!match) return;
      clearTimeout(timeout);
      resolveStart({ child, port: Number(match[1]), stdout });
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      rejectStart(new Error(`server exited before listening (${code ?? signal})\nstdout: ${stdout}\nstderr: ${stderr}`));
    });
  });
}

function stopServer(child) {
  return new Promise((resolveStop, rejectStop) => {
    child.once("exit", (code, signal) => {
      if (code === 0 || signal === "SIGTERM") resolveStop();
      else rejectStop(new Error(`server shutdown failed (${code ?? signal})`));
    });
    child.kill("SIGTERM");
  });
}

test("package serve command launches the dependency-free Node server", async () => {
  // Given: package scripts define the default preview surface.
  const packageJson = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));

  // When: the serve command is selected.
  // Then: it launches the checked ESM server without a framework dependency.
  assert.equal(packageJson.scripts.serve, "node scripts/serve.mjs");
});

describe("spawned static server", () => {
let server;

before(async () => {
  server = await startServer({ args: ["--port", "0"], env: { PORT: "65534" } });
});

after(async () => {
  if (server?.child.exitCode === null) await stopServer(server.child);
});

test("CLI port zero overrides PORT and reports the assigned port", () => {
  // Given: PORT names a different fixed port and CLI requests an ephemeral port.
  // When: the shared server reaches its listening state.
  // Then: its discoverable port is the OS assignment, not the environment value.
  assert.ok(server.port > 0 && server.port < 65_536);
  assert.notEqual(server.port, 65_534);
  assert.match(server.stdout, new RegExp(`http://127\\.0\\.0\\.1:${server.port}/`));
});

test("PORT environment accepts zero and reports the assigned port", async () => {
  // Given: no CLI port and PORT=0 request an ephemeral listener.
  const environmentServer = await startServer({ env: { PORT: "0" } });

  try {
    // When: the reported address is requested.
    const response = await request({ port: environmentServer.port });

    // Then: the assigned port is usable and serves the application root.
    assert.ok(environmentServer.port > 0 && environmentServer.port < 65_536);
    assert.equal(response.status, 200);
  } finally {
    await stopServer(environmentServer.child);
  }
});

test("GET root returns HTTP 1.1 and the exact index bytes", async () => {
  // Given: the checked index bytes.
  const expected = await readFile(resolve(ROOT, "index.html"));

  // When: a real GET reaches the default route.
  const response = await request({ port: server.port });

  // Then: status, protocol, MIME, and bytes match the static contract.
  assert.equal(response.status, 200);
  assert.equal(response.httpVersion, "1.1");
  assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
  assert.deepEqual(response.body, expected);
});

test("Brotli is preferred for JavaScript and decompresses to exact bytes", async () => {
  // Given: the checked bundle and a client accepting gzip and Brotli.
  const expected = await readFile(resolve(ROOT, "js/app.bundle.js"));

  // When: the JavaScript asset is requested.
  const response = await request({
    port: server.port,
    path: "/js/app.bundle.js",
    headers: { "Accept-Encoding": "gzip, br" },
  });

  // Then: representation headers are exact and decompression restores the source.
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "text/javascript; charset=utf-8");
  assert.equal(response.headers["content-encoding"], "br");
  assert.equal(response.headers.vary, "Accept-Encoding");
  assert.equal(Number(response.headers["content-length"]), response.body.length);
  assert.deepEqual(brotliDecompressSync(response.body), expected);
});

test("gzip is negotiated for CSS and decompresses to exact bytes", async () => {
  // Given: the checked layout stylesheet and a gzip-only client.
  const expected = await readFile(resolve(ROOT, "styles/layout.css"));

  // When: the CSS asset is requested.
  const response = await request({
    port: server.port,
    path: "/styles/layout.css",
    headers: { "Accept-Encoding": "gzip" },
  });

  // Then: representation headers are exact and decompression restores the source.
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "text/css; charset=utf-8");
  assert.equal(response.headers["content-encoding"], "gzip");
  assert.equal(response.headers.vary, "Accept-Encoding");
  assert.equal(Number(response.headers["content-length"]), response.body.length);
  assert.deepEqual(gunzipSync(response.body), expected);
});

test("identity fallback preserves exact JavaScript bytes", async () => {
  // Given: the checked bundle and no accepted compression.
  const expected = await readFile(resolve(ROOT, "js/app.bundle.js"));

  // When: the asset is requested without Accept-Encoding.
  const response = await request({ port: server.port, path: "/js/app.bundle.js" });

  // Then: no encoding is declared and the wire bytes are the source bytes.
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-encoding"], undefined);
  assert.equal(Number(response.headers["content-length"]), expected.length);
  assert.deepEqual(response.body, expected);
});

test("HEAD returns status and MIME with an empty body", async () => {
  // Given: a CSS resource path.
  // When: a real HEAD request reaches the server.
  const response = await request({ port: server.port, path: "/styles/layout.css", method: "HEAD" });

  // Then: metadata matches GET while no representation body is transferred.
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "text/css; charset=utf-8");
  assert.equal(response.body.length, 0);
});

test("Range applies only to GET and unsupported multi-range requests use the full representation", async () => {
  const expected = await readFile(resolve(ROOT, "js/app.bundle.js"));

  const bounded = await request({
    port: server.port,
    path: "/js/app.bundle.js",
    headers: { Range: "bytes=2-9", "Accept-Encoding": "br, gzip" },
  });
  assert.equal(bounded.status, 206);
  assert.equal(bounded.headers["accept-ranges"], "bytes");
  assert.equal(bounded.headers["content-range"], `bytes 2-9/${expected.length}`);
  assert.equal(bounded.headers["content-length"], "8");
  assert.equal(bounded.headers["content-encoding"], undefined);
  assert.deepEqual(bounded.body, expected.subarray(2, 10));

  const openEnded = await request({
    port: server.port,
    path: "/js/app.bundle.js",
    headers: { Range: `bytes=${expected.length - 8}-` },
  });
  assert.equal(openEnded.status, 206);
  assert.equal(openEnded.headers["content-range"], `bytes ${expected.length - 8}-${expected.length - 1}/${expected.length}`);
  assert.deepEqual(openEnded.body, expected.subarray(expected.length - 8));

  const suffix = await request({
    port: server.port,
    path: "/js/app.bundle.js",
    headers: { Range: "bytes=-8" },
  });
  assert.equal(suffix.status, 206);
  assert.equal(suffix.headers["content-range"], `bytes ${expected.length - 8}-${expected.length - 1}/${expected.length}`);
  assert.deepEqual(suffix.body, expected.subarray(expected.length - 8));

  const unsatisfiable = await request({
    port: server.port,
    path: "/js/app.bundle.js",
    headers: { Range: "bytes=999999999-" },
  });
  assert.equal(unsatisfiable.status, 416);
  assert.equal(unsatisfiable.headers["content-range"], `bytes */${expected.length}`);
  assert.equal(unsatisfiable.body.length, 0);

  for (const range of ["bytes=bogus", "bytes=0-1,3-4", "bytes=0-1,999999999-"]) {
    const ignored = await request({
      port: server.port,
      path: "/js/app.bundle.js",
      headers: { Range: range },
    });
    assert.equal(ignored.status, 200, range);
    assert.equal(ignored.headers["content-range"], undefined, range);
    assert.equal(ignored.headers["content-length"], String(expected.length), range);
    assert.deepEqual(ignored.body, expected, range);
  }

  const head = await request({
    port: server.port,
    path: "/js/app.bundle.js",
    method: "HEAD",
    headers: { Range: "bytes=2-9" },
  });
  assert.equal(head.status, 200);
  assert.equal(head.headers["content-range"], undefined);
  assert.equal(head.headers["content-length"], String(expected.length));
  assert.equal(head.body.length, 0);
});

test("missing resources return 404", async () => {
  // Given: an in-root path that does not exist.
  // When: it is requested with GET.
  const response = await request({ port: server.port, path: "/missing.txt" });

  // Then: the server returns an explicit not-found response.
  assert.equal(response.status, 404);
  assert.equal(response.body.toString("utf8"), "Not Found\n");
});

test("unsupported methods return 405 with Allow", async () => {
  // Given: an existing route and an unsupported method.
  // When: POST reaches the static server.
  const response = await request({ port: server.port, path: "/", method: "POST" });

  // Then: the response advertises the complete allowed method set.
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, "GET, HEAD");
  assert.equal(response.body.toString("utf8"), "Method Not Allowed\n");
});

test("parent traversal is forbidden before normalization", async () => {
  // Given: a raw path that attempts to leave the document root.
  // When: the traversal target is requested.
  const response = await request({ port: server.port, path: "/../package.json" });

  // Then: normalization cannot turn it into an in-root request.
  assert.equal(response.status, 403);
  assert.equal(response.body.toString("utf8"), "Forbidden\n");
});

test("encoded traversal is forbidden after safe decoding", async () => {
  // Given: encoded path separators and parent segments that leave the root.
  // When: the encoded traversal target is requested.
  const response = await request({ port: server.port, path: "/styles/%2e%2e/%2e%2e/package.json" });

  // Then: decoding occurs before the document-root boundary check.
  assert.equal(response.status, 403);
  assert.equal(response.body.toString("utf8"), "Forbidden\n");
});

test("malformed URL encoding returns 400 without crashing", async () => {
  // Given: an incomplete percent-encoded path.
  // When: the malformed target is requested.
  const response = await request({ port: server.port, path: "/%E0%A4%A" });

  // Then: the bad boundary input is rejected explicitly.
  assert.equal(response.status, 400);
  assert.equal(response.body.toString("utf8"), "Bad Request\n");
});

test("normalized paths that remain inside the root are served", async () => {
  // Given: an in-root path containing a safe parent segment.
  const expected = await readFile(resolve(ROOT, "styles/layout.css"));

  // When: the normalized resource is requested.
  const response = await request({ port: server.port, path: "/styles/../styles/layout.css" });

  // Then: the resolved path stays within the root and returns exact bytes.
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected);
});
});
