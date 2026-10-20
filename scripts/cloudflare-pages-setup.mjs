/**
 * Configure Cloudflare Pages env vars + build settings (no secrets logged).
 * Usage: node scripts/cloudflare-pages-setup.mjs [project-name]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ACCOUNT_ID = "3c417d1f8fc7be058f75b20769bb1bb1";
const PROJECT = process.argv[2] ?? "airspace-3d";

function wranglerToken() {
  const cfg = path.join(
    os.homedir(),
    "AppData",
    "Roaming",
    "xdg.config",
    ".wrangler",
    "config",
    "default.toml",
  );
  const text = fs.readFileSync(cfg, "utf8");
  const m = text.match(/^oauth_token\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error("Run: npx wrangler login");
  return m[1];
}

function parseEnvFile(filePath) {
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function secretVar(value) {
  return { type: "secret_text", value };
}

function plainVar(value) {
  return { type: "plain_text", value };
}

async function cf(method, apiPath, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${wranglerToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(JSON.stringify(json.errors ?? json));
  }
  return json.result;
}

const env = parseEnvFile(path.join(process.cwd(), ".env"));
const cesium = env.VITE_CESIUM_ION_ACCESS_TOKEN;
const osKey = env.VITE_OS_API_KEY;
if (!cesium || !osKey) {
  throw new Error("Missing VITE_CESIUM_ION_ACCESS_TOKEN or VITE_OS_API_KEY in .env");
}

const envBlock = {
  VITE_CESIUM_ION_ACCESS_TOKEN: secretVar(cesium),
  VITE_OS_API_KEY: secretVar(osKey),
  NODE_VERSION: plainVar("22"),
};

const deployConfig = {
  build_command: "npm run build",
  destination_dir: "dist",
  root_dir: "",
  env_vars: envBlock,
};

let project;
try {
  project = await cf("GET", `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`);
  console.log(`Project "${PROJECT}" already exists.`);
} catch {
  project = await cf("POST", `/accounts/${ACCOUNT_ID}/pages/projects`, {
    name: PROJECT,
    production_branch: "main",
    build_config: {
      build_command: deployConfig.build_command,
      destination_dir: deployConfig.destination_dir,
      root_dir: deployConfig.root_dir,
    },
  });
  console.log(`Created project "${PROJECT}".`);
}

await cf("PATCH", `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`, {
  build_config: {
    build_command: deployConfig.build_command,
    destination_dir: deployConfig.destination_dir,
    root_dir: deployConfig.root_dir,
  },
  deployment_configs: {
    production: deployConfig,
    preview: deployConfig,
  },
});

console.log("Set Production + Preview env vars and build settings.");
console.log(`Pages URL: https://${PROJECT}.pages.dev`);
console.log(
  "If Git is not connected yet: Dashboard → Workers & Pages →",
  PROJECT,
  "→ Settings → Builds → Connect GitHub → Speckybams/airspace-3d, then Retry deployment.",
);
