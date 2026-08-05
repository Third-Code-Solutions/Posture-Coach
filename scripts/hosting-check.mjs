import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const staticServer = resolve(projectRoot, "scripts/static-server.mjs");
const port = 34_123;
const origin = `http://127.0.0.1:${port}`;

async function assertFile(path) {
  await access(path);
}

async function waitForHealth(child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Static server exited with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(`${origin}/healthz`);

      if (response.status === 200 && (await response.text()).trim() === "ok") {
        return;
      }
    } catch {
      // The server may still be binding its port.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  throw new Error("Static server did not become healthy within 5 seconds");
}

async function expectStatus(pathname, expectedStatus) {
  const response = await fetch(`${origin}${pathname}`);

  if (response.status !== expectedStatus) {
    throw new Error(`${pathname} returned ${response.status}; expected ${expectedStatus}`);
  }

  return response;
}

await assertFile(resolve(projectRoot, "out/index.html"));
await assertFile(resolve(projectRoot, "out/models/pose_landmarker_full.task"));
await assertFile(resolve(projectRoot, "out/wasm/vision_wasm_internal.wasm"));

const child = spawn(process.execPath, [staticServer], {
  cwd: projectRoot,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "ignore", "pipe"],
});
let errorOutput = "";
child.stderr.on("data", (chunk) => {
  errorOutput += chunk.toString();
});

try {
  await waitForHealth(child);

  const rootResponse = await expectStatus("/", 200);
  const rootBody = await rootResponse.text();
  if (!rootBody.includes("Form / Local")) {
    throw new Error("Root response does not contain the application title");
  }
  for (const header of [
    "content-security-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "permissions-policy",
    "referrer-policy",
    "x-content-type-options",
    "x-frame-options",
  ]) {
    if (!rootResponse.headers.get(header)) {
      throw new Error(`Root response is missing security header: ${header}`);
    }
  }

  const modelResponse = await expectStatus("/models/pose_landmarker_full.task", 200);
  if (modelResponse.headers.get("content-type") !== "application/octet-stream") {
    throw new Error("Pose model content type is not application/octet-stream");
  }
  if (!modelResponse.headers.get("cache-control")?.includes("must-revalidate")) {
    throw new Error("Pose model cache policy must be revalidated");
  }

  const wasmResponse = await expectStatus("/wasm/vision_wasm_internal.wasm", 200);
  if (wasmResponse.headers.get("content-type") !== "application/wasm") {
    throw new Error("Wasm content type is not application/wasm");
  }
  if (!wasmResponse.headers.get("cache-control")?.includes("must-revalidate")) {
    throw new Error("Wasm cache policy must be revalidated");
  }

  await expectStatus("/does-not-exist", 404);
  await expectStatus("/package.json", 404);
  await expectStatus("/healthzone", 404);
  await expectStatus("/%2e%2e/%2e%2e/package.json", 404);

  const headResponse = await fetch(`${origin}/`, { method: "HEAD" });
  if (headResponse.status !== 200 || (await headResponse.text()) !== "") {
    throw new Error(`HEAD / returned ${headResponse.status} with a response body`);
  }

  const methodResponse = await fetch(`${origin}/`, { method: "POST" });
  if (methodResponse.status !== 405) {
    throw new Error(`POST / returned ${methodResponse.status}; expected 405`);
  }

  const healthMethodResponse = await fetch(`${origin}/healthz`, { method: "POST" });
  if (healthMethodResponse.status !== 405) {
    throw new Error(`POST /healthz returned ${healthMethodResponse.status}; expected 405`);
  }

  console.log(
    "Hosting check passed: PORT binding, health, static assets, 404, and method handling.",
  );
} catch (error) {
  const detail = errorOutput.trim();
  throw new Error(
    `${error instanceof Error ? error.message : String(error)}${detail ? `\n${detail}` : ""}`,
  );
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
}
