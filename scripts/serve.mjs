import { readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import {
  brotliCompressSync,
  constants as zlibConstants,
  gzipSync,
} from "node:zlib";

const MIME_TYPES = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
]);
const PRELOAD_PATHS = [
  "index.html",
  "styles/tokens.css",
  "styles/layout.css",
  "styles/components.css",
  "styles/responsive.css",
  "js/app.bundle.js",
];
const ROOT = await realpath(process.cwd());
const PUBLIC_FILES = new Set(PRELOAD_PATHS.map((relativePath) => resolve(ROOT, relativePath)));
const assetCache = new Map();
const COMPRESSIBLE_ENCODINGS = ["br", "gzip", "identity"];
const IDENTITY_ENCODING = ["identity"];
const QUALITY_VALUE = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

class RequestPathError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function optionValue(name) {
  const directIndex = process.argv.indexOf(name);
  const argument = directIndex === -1
    ? process.argv.find((candidate) => candidate.startsWith(`${name}=`))
    : process.argv[directIndex + 1];
  if (argument === undefined && directIndex === -1) return undefined;
  const value = directIndex === -1 ? argument.slice(name.length + 1) : argument;
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return value;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function isInsideRoot(filePath) {
  return filePath === ROOT || filePath.startsWith(`${ROOT}${sep}`);
}

async function resolveRequestPath(rawTarget) {
  if (typeof rawTarget !== "string" || !rawTarget.startsWith("/")) {
    throw new RequestPathError(400, "Bad Request\n");
  }

  const encodedPath = rawTarget.split("?", 1)[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(encodedPath).replaceAll("\\", "/");
  } catch (error) {
    if (error instanceof URIError) throw new RequestPathError(400, "Bad Request\n");
    throw error;
  }
  if (decodedPath.includes("\0")) throw new RequestPathError(400, "Bad Request\n");

  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const candidate = resolve(ROOT, `.${requestedPath}`);
  if (!isInsideRoot(candidate)) throw new RequestPathError(403, "Forbidden\n");
  if (!PUBLIC_FILES.has(candidate)) throw new RequestPathError(404, "Not Found\n");

  try {
    const canonicalPath = await realpath(candidate);
    if (!isInsideRoot(canonicalPath)) throw new RequestPathError(403, "Forbidden\n");
    if (!(await stat(canonicalPath)).isFile()) throw new RequestPathError(404, "Not Found\n");
    return canonicalPath;
  } catch (error) {
    if (error instanceof RequestPathError) throw error;
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR" || error?.code === "EISDIR") {
      throw new RequestPathError(404, "Not Found\n");
    }
    if (error?.code === "EACCES") throw new RequestPathError(403, "Forbidden\n");
    throw error;
  }
}

function isCompressible(contentType) {
  return contentType.startsWith("text/")
    || contentType.startsWith("application/json")
    || contentType.startsWith("application/xml")
    || contentType.startsWith("image/svg+xml");
}

async function loadAsset(filePath) {
  const cached = assetCache.get(filePath);
  if (cached) return cached;

  const identity = await readFile(filePath);
  const contentType = MIME_TYPES.get(extname(filePath).toLowerCase()) ?? "application/octet-stream";
  const compressible = isCompressible(contentType);
  const asset = {
    contentType,
    compressible,
    identity,
    br: compressible ? brotliCompressSync(identity, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
    }) : identity,
    gzip: compressible ? gzipSync(identity, { level: 9 }) : identity,
  };
  assetCache.set(filePath, asset);
  return asset;
}

function parseEncodingQualities(header) {
  const qualities = new Map();
  for (const entry of String(header ?? "").split(",")) {
    const [name, ...parameters] = entry.trim().toLowerCase().split(";").map((part) => part.trim());
    if (!name) continue;
    let quality = 1;
    if (parameters.length > 0) {
      const match = parameters.length === 1 ? parameters[0].match(/^q=(.*)$/) : null;
      quality = match && QUALITY_VALUE.test(match[1]) ? Number(match[1]) : 0;
    }
    qualities.set(name, quality);
  }
  return qualities;
}

function chooseEncoding(header, availableEncodings) {
  const qualities = parseEncodingQualities(header);
  const wildcard = qualities.get("*");
  let selected;
  let selectedQuality = 0;
  for (const encoding of availableEncodings) {
    const quality = qualities.has(encoding)
      ? qualities.get(encoding)
      : encoding === "identity" ? (wildcard === 0 ? 0 : 1) : (wildcard ?? 0);
    if (quality > selectedQuality) {
      selected = encoding;
      selectedQuality = quality;
    }
  }
  return selected;
}

function parseByteRange(header, size) {
  if (header === undefined) return undefined;
  if (typeof header !== "string") return null;
  if (header.includes(",")) return undefined;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return undefined;
  if (size === 0) return null;

  const sizeBigInt = BigInt(size);
  if (match[1]) {
    const start = BigInt(match[1]);
    const requestedEnd = match[2] ? BigInt(match[2]) : sizeBigInt - 1n;
    if (start >= sizeBigInt || start > requestedEnd) return null;
    return { start: Number(start), end: Number(requestedEnd >= sizeBigInt ? sizeBigInt - 1n : requestedEnd) };
  }

  const suffixLength = BigInt(match[2]);
  if (suffixLength === 0n) return null;
  return {
    start: Number(suffixLength >= sizeBigInt ? 0n : sizeBigInt - suffixLength),
    end: size - 1,
  };
}

function sendText(response, { status, text, headers = {} }) {
  const body = Buffer.from(text);
  response.writeHead(status, {
    "Cache-Control": "no-cache",
    "Content-Length": String(body.length),
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(body);
}

async function handleRequest(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, {
      status: 405,
      text: "Method Not Allowed\n",
      headers: { Allow: "GET, HEAD" },
    });
    return;
  }

  let filePath;
  try {
    filePath = await resolveRequestPath(request.url);
  } catch (error) {
    if (error instanceof RequestPathError) {
      sendText(response, { status: error.status, text: error.message });
      return;
    }
    throw error;
  }

  const asset = await loadAsset(filePath);
  const range = request.method === "GET"
    ? parseByteRange(request.headers.range, asset.identity.length)
    : undefined;
  if (range === null) {
    response.writeHead(416, {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
      "Content-Length": "0",
      "Content-Range": `bytes */${asset.identity.length}`,
      "X-Content-Type-Options": "nosniff",
    });
    response.end();
    return;
  }

  const availableEncodings = asset.compressible ? COMPRESSIBLE_ENCODINGS : IDENTITY_ENCODING;
  const encoding = range ? "identity" : chooseEncoding(request.headers["accept-encoding"], availableEncodings);
  if (!encoding) {
    sendText(response, {
      status: 406,
      text: "Not Acceptable\n",
      headers: { Vary: "Accept-Encoding" },
    });
    return;
  }
  const body = range ? asset.identity.subarray(range.start, range.end + 1) : asset[encoding];
  const headers = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    "Content-Length": String(body.length),
    "Content-Type": asset.contentType,
    "X-Content-Type-Options": "nosniff",
  };
  if (asset.compressible) headers.Vary = "Accept-Encoding";
  if (encoding !== "identity") headers["Content-Encoding"] = encoding;
  if (range) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${asset.identity.length}`;

  response.writeHead(range ? 206 : 200, headers);
  response.end(request.method === "HEAD" ? undefined : body);
}

await Promise.all(PRELOAD_PATHS.map(async (relativePath) => {
  const filePath = await realpath(resolve(ROOT, relativePath));
  await loadAsset(filePath);
}));

const port = parsePort(optionValue("--port") ?? process.env.PORT ?? "4173");
const host = optionValue("--host") ?? "127.0.0.1";
const server = createServer((request, response) => {
  handleRequest(request, response).catch(() => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    sendText(response, { status: 500, text: "Internal Server Error\n" });
  });
});

server.on("clientError", (_error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});
server.on("error", (error) => {
  process.stderr.write(`Unable to serve GreenWorth: ${error.message}\n`);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  const address = server.address();
  const assignedPort = typeof address === "object" && address ? address.port : port;
  process.stdout.write(`Serving GreenWorth at http://${host}:${assignedPort}/\n`);
});

let shuttingDown = false;
let forceTimer;
function shutDown() {
  if (shuttingDown) return server.closeAllConnections();
  shuttingDown = true;
  forceTimer = setTimeout(() => server.closeAllConnections(), 1_000).unref();
  server.close((error) => {
    clearTimeout(forceTimer);
    if (!error) return;
    process.stderr.write(`Unable to close GreenWorth server: ${error.message}\n`);
    process.exitCode = 1;
  });
  server.closeIdleConnections();
}
process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
