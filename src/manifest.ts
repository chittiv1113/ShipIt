import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "ShipIt",
  version: "0.1.0",
  description: "ShipIt: Push accepted LeetCode solutions to GitHub.",
  action: {
    default_title: "ShipIt",
    default_popup: "src/popup/index.html"
  },
  options_page: "src/options/index.html",
  background: {
    service_worker: "src/background/service_worker.ts",
    type: "module"
  },
  permissions: ["storage"],
  host_permissions: ["https://leetcode.com/*", "https://api.github.com/*"],
  content_scripts: [
    {
      matches: ["https://leetcode.com/problems/*"],
      js: ["src/content/content_script.ts"],
      run_at: "document_idle"
    }
  ],
  web_accessible_resources: [
    {
      resources: ["src/injected/injected.ts"],
      matches: ["https://leetcode.com/*"]
    }
  ],
  icons: {
    "16": "src/assets/icon16.png",
    "48": "src/assets/icon48.png",
    "128": "src/assets/icon128.png"
  }
};

export default manifest;
