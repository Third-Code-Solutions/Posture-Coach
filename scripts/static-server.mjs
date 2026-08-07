import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";

const root = resolve(process.cwd(), "out");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT: ${process.env.PORT ?? ""}`);
}

const mimeTypes = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".task", "application/octet-stream"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; font-src 'self';",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function safeCandidate(pathname) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decodedPath.includes("\0")) {
    return null;
  }

  const candidate = resolve(root, decodedPath.replace(/^[/\\]+/, ""));
  const relativePath = relative(root, candidate);

  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || relativePath.includes("\0")) {
    return null;
  }

  return candidate;
}

async function fileIfRegular(candidate) {
  if (!candidate) {
    return null;
  }

  const stats = await fs.stat(candidate).catch(() => null);
  return stats?.isFile() ? candidate : null;
}

async function findStaticFile(pathname) {
  const candidate = safeCandidate(pathname);
  const directFile = await fileIfRegular(candidate);

  if (directFile) {
    return directFile;
  }

  const indexFile = await fileIfRegular(candidate && join(candidate, "index.html"));

  if (indexFile) {
    return indexFile;
  }

  if (!pathname.endsWith("/")) {
    return fileIfRegular(safeCandidate(`${pathname}.html`));
  }

  return null;
}

function cacheControl(filePath) {
  const relativePath = relative(root, filePath).replaceAll("\\", "/");

  if (relativePath.startsWith("_next/")) {
    return "public, max-age=31536000, immutable";
  }

  if (relativePath.startsWith("models/") || relativePath.startsWith("wasm/")) {
    return "public, max-age=86400, must-revalidate";
  }

  return "no-cache";
}

function sendText(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-cache",
    "Content-Type": "text/plain; charset=utf-8",
    ...securityHeaders,
    ...headers,
  });
  response.end(body);
}

async function sendStaticFile(request, response, filePath, statusCode = 200) {
  const stats = await fs.stat(filePath);
  const contentType = mimeTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream";

  response.writeHead(statusCode, {
    "Cache-Control": cacheControl(filePath),
    "Content-Length": stats.size,
    "Content-Type": contentType,
    ...securityHeaders,
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath)
    .on("error", (error) => {
      response.destroy(error);
    })
    .pipe(response);
}

const indexFile = join(root, "index.html");
await fs.access(indexFile);

const server = createServer(async (request, response) => {
  try {
    if (request.url === undefined) {
      sendText(response, 400, "Bad request\n");
      return;
    }

    const requestUrl = new URL(request.url, "http://localhost");

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendText(response, 405, "Method not allowed\n", { Allow: "GET, HEAD" });
      return;
    }

    if (requestUrl.pathname === "/healthz") {
      sendText(response, 200, "ok\n");
      return;
    }

    const pathname = requestUrl.pathname;
    const filePath = await findStaticFile(pathname);

    if (filePath) {
      await sendStaticFile(request, response, filePath);
      return;
    }

    const notFoundFile = await fileIfRegular(join(root, "404.html"));

    if (notFoundFile) {
      await sendStaticFile(request, response, notFoundFile, 404);
      return;
    }

    sendText(response, 404, "Not found\n");
  } catch (error) {
    console.error("Static server request failed", error);

    if (!response.headersSent) {
      sendText(response, 500, "Internal server error\n");
    } else {
      response.destroy(error);
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Static server listening on port ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
