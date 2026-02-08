import type { PushRequest, PushResponse } from "../shared/types";
import { getSettings } from "../shared/storage";
import { buildHeader, extFromLanguageId, renderPath } from "../shared/settings";
import { getExistingFileSha, putFile } from "../shared/github";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ShipIt] Installed");
});

chrome.runtime.onMessage.addListener((message: PushRequest, _sender, sendResponse: (r: PushResponse) => void) => {
  if (message?.type !== "SHIPIT_PUSH") return false;

  (async () => {
    try {
      const settings = await getSettings();
      if (!settings.githubToken) return sendResponse({ ok: false, error: "Missing GitHub token. Open ShipIt settings." });
      if (!settings.repoFullName) return sendResponse({ ok: false, error: "Missing repo (owner/repo). Open ShipIt settings." });

      const [owner, repo] = settings.repoFullName.split("/");
      const ext = extFromLanguageId(message.payload.languageId);
      const path = renderPath(settings.pathTemplate, { slug: message.payload.slug, ext });

      // Build content with a small header.
      const content = buildHeader({ title: message.payload.title, url: message.payload.url, languageId: message.payload.languageId }) + message.payload.code;

      // Check existing file (for overwrite policy)
      const existing = await getExistingFileSha({
        token: settings.githubToken,
        owner,
        repo,
        branch: settings.branch,
        path
      });
      if ("error" in existing) return sendResponse({ ok: false, error: existing.error });

      if (existing.exists && settings.overwriteMode === "no-overwrite") {
        return sendResponse({ ok: false, error: "File already exists and overwrite is disabled." });
      }

      const put = await putFile({
        token: settings.githubToken,
        owner,
        repo,
        branch: settings.branch,
        path,
        message: `ShipIt: ${message.payload.slug}`,
        contentUtf8: content,
        sha: existing.exists ? existing.sha : undefined
      });

      if (!put.ok) return sendResponse({ ok: false, error: put.error });

      const commitUrl = put.commitSha ? `https://github.com/${owner}/${repo}/commit/${put.commitSha}` : undefined;
      return sendResponse({ ok: true, path, commitUrl });
    } catch (e: any) {
      return sendResponse({ ok: false, error: e?.message || "Unknown error" });
    }
  })();

  return true;
});
