import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import { dirname, resolve } from "node:path";
import test, { after, before, describe } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_PATH = resolve(ROOT, "scripts/serve.mjs");
const TEST_TIMEOUT_MS = 7_000;

function boundedTest(name, body) {
  return test(name, { timeout: TEST_TIMEOUT_MS }, body);
}

function request({ port, path = "/js/app.bundle.js", method = "GET", encoding }) {
  return new Promise((resolveRequest, rejectRequest) => {
    const headers = encoding === undefined ? {} : { "Accept-Encoding": encoding };
    const outgoing = http.request({ hostname: "127.0.0.1", port, path, method, headers }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () => resolveRequest({
        status: incoming.statusCode,
        headers: incoming.headers,
        body: Buffer.concat(chunks),
      }));
    });
    outgoing.on("error", rejectRequest);
    outgoing.end();
  });
}

function startServer() {
  const child = spawn(process.execPath, [SERVER_PATH, "--port", "0"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolveStart, rejectStart) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectStart(new Error(`startup timeout\n${stderr}`));
    }, 5_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const match = stdout.match(/127\.0\.0\.1:(\d+)\//);
      if (!match) return;
      clearTimeout(timeout);
      resolveStart({ child, port: Number(match[1]) });
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      rejectStart(new Error(`server exited before listening (${code ?? signal})\n${stderr}`));
    });
  });
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ exited: true, code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolveExit) => {
    const onExit = (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ exited: true, code, signal });
    };
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolveExit({ exited: false, code: null, signal: null });
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

async function terminate(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGKILL");
  await waitForExit(child, 1_000);
}

async function openIncompleteRequest(port) {
  const socket = net.createConnection({ host: "127.0.0.1", port });
  await once(socket, "connect");
  socket.write("GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n");
  return socket;
}

describe("static server protocol boundaries", { timeout: TEST_TIMEOUT_MS }, () => {
let server;

before(async () => { server = await startServer(); });
after(async () => {
  if (server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill("SIGTERM");
    const outcome = await waitForExit(server.child, 2_000);
    if (!outcome.exited) await terminate(server.child);
  }
});

boundedTest("higher gzip q outranks earlier Brotli", async () => {
  const response = await request({ port: server.port, encoding: "br;q=.1, gzip;q=1" });
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-encoding"], "gzip");
});

boundedTest("wildcard applies only to unspecified supported codings", async () => {
  const response = await request({ port: server.port, encoding: "br;q=0.2, *;q=0.8, identity;q=0.3" });
  assert.equal(response.headers["content-encoding"], "gzip");
});

boundedTest("explicit identity wins when it has the highest quality", async () => {
  const response = await request({ port: server.port, encoding: "br;q=0.4, gzip;q=0.5, identity;q=0.9" });
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-encoding"], undefined);
});

boundedTest("explicit identity remains available when wildcard excludes codings", async () => {
  const response = await request({ port: server.port, encoding: "identity;q=1, *;q=0" });
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-encoding"], undefined);
});

boundedTest("GET returns 406 when every representation is unacceptable", async () => {
  const response = await request({ port: server.port, encoding: "br;q=0, gzip;q=0, identity;q=0" });
  assert.equal(response.status, 406);
  assert.equal(response.headers.vary, "Accept-Encoding");
  assert.equal(response.body.toString("utf8"), "Not Acceptable\n");
});

boundedTest("HEAD returns 406 metadata with an empty body", async () => {
  const response = await request({
    port: server.port,
    method: "HEAD",
    encoding: "br;q=0, gzip;q=0, identity;q=0",
  });
  assert.equal(response.status, 406);
  assert.equal(response.headers.vary, "Accept-Encoding");
  assert.equal(response.body.length, 0);
});

boundedTest("zero-quality wildcard excludes implicit identity", async () => {
  const response = await request({ port: server.port, encoding: "*;q=0" });
  assert.equal(response.status, 406);
});

boundedTest("out-of-range quality cannot select its coding", async () => {
  const response = await request({ port: server.port, encoding: "br;q=1.1, gzip;q=1, identity;q=0" });
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-encoding"], "gzip");
});

boundedTest("malformed quality cannot select its coding", async () => {
  const response = await request({ port: server.port, encoding: "br;q=bogus, gzip;q=0, identity;q=0" });
  assert.equal(response.status, 406);
});

boundedTest("over-precise quality cannot outrank a valid coding", async () => {
  const response = await request({ port: server.port, encoding: "br;q=0.1234, gzip;q=0.2, identity;q=0" });
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-encoding"], "gzip");
});

const publicPaths = [
  "/",
  "/index.html",
  "/styles/tokens.css",
  "/styles/layout.css",
  "/styles/components.css",
  "/styles/responsive.css",
  "/js/app.bundle.js",
];
const privatePaths = [
  "/package.json",
  "/scripts/serve.mjs",
  "/tests/static-server.test.mjs",
  "/.omo/boulder.json",
  `/${encodeURIComponent("★ 육상풍력재무모델 (예시).xlsx")}`,
];

boundedTest("GET serves every allowlisted public asset", async () => {
  const responses = await Promise.all(publicPaths.map((path) => request({ port: server.port, path })));
  assert.deepEqual(responses.map((response) => response.status), publicPaths.map(() => 200));
});

boundedTest("HEAD serves every allowlisted public asset without a body", async () => {
  const responses = await Promise.all(publicPaths.map((path) => request({ port: server.port, path, method: "HEAD" })));
  assert.deepEqual(responses.map((response) => response.status), publicPaths.map(() => 200));
  assert.ok(responses.every((response) => response.body.length === 0));
});

for (const path of privatePaths) {
  boundedTest(`non-public target ${path} returns 404`, async () => {
    const response = await request({ port: server.port, path });
    assert.equal(response.status, 404);
    assert.equal(response.body.toString("utf8"), "Not Found\n");
  });
}

boundedTest("HEAD hides every non-public target", async () => {
  const responses = await Promise.all(privatePaths.map((path) => request({ port: server.port, path, method: "HEAD" })));
  assert.deepEqual(responses.map((response) => response.status), privatePaths.map(() => 404));
  assert.ok(responses.every((response) => response.body.length === 0));
});

for (const path of ["/styles", "/styles/", "/."]) {
  boundedTest(`directory target ${path} returns 404 instead of 500`, async () => {
    const response = await request({ port: server.port, path });
    assert.equal(response.status, 404);
    assert.equal(response.body.toString("utf8"), "Not Found\n");
  });
}
});

boundedTest("missing CLI port value fails closed without listening", async () => {
  const child = spawn(process.execPath, [SERVER_PATH, "--port"], {
    cwd: ROOT,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  try {
    const outcome = await Promise.race([
      waitForExit(child, 2_000),
      new Promise((resolveListen) => child.stdout.on("data", () => {
        if (stdout.includes("Serving GreenWorth")) resolveListen({ exited: false, listening: true });
      })),
    ]);
    assert.equal(outcome.exited, true, `unexpected listener output: ${stdout}`);
    assert.notEqual(outcome.code, 0);
  } finally {
    await terminate(child);
  }
});

boundedTest("first shutdown signal bounds an incomplete-header connection", async () => {
  const instance = await startServer();
  let socket;
  try {
    socket = await openIncompleteRequest(instance.port);
    instance.child.kill("SIGTERM");
    const outcome = await waitForExit(instance.child, 1_900);
    assert.equal(outcome.exited, true);
  } finally {
    socket?.destroy();
    await terminate(instance.child);
  }
});

boundedTest("second shutdown signal force-closes an incomplete-header connection", async () => {
  const instance = await startServer();
  let socket;
  try {
    socket = await openIncompleteRequest(instance.port);
    instance.child.kill("SIGTERM");
    instance.child.kill("SIGINT");
    const outcome = await waitForExit(instance.child, 900);
    assert.equal(outcome.exited, true);
  } finally {
    socket?.destroy();
    await terminate(instance.child);
  }
});
