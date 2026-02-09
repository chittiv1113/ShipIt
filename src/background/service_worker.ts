import type { PushResponse, ShipItRequest, ShipItResponse } from "../shared/types";
import { getSettings } from "../shared/storage";
import { buildHeader, extFromLanguageId, renderPath } from "../shared/settings";
import { getExistingFileSha, putFile } from "../shared/github";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ShipIt] Installed");
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;

  chrome.tabs.sendMessage(tab.id, { type: "SHIPIT_OPEN_TOAST" }, () => {
    if (chrome.runtime.lastError) {
      console.debug("[ShipIt] Could not open toast on this tab:", chrome.runtime.lastError.message);
    }
  });
});

chrome.runtime.onMessage.addListener((message: ShipItRequest, _sender, sendResponse: (r: ShipItResponse) => void) => {
  if (message?.type === "SHIPIT_OPEN_SETTINGS") {
    chrome.runtime
      .openOptionsPage()
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => {
        const error = e instanceof Error ? e.message : "Could not open settings page.";
        sendResponse({ ok: false, error });
      });

    return true;
  }

  if (message?.type !== "SHIPIT_PUSH") return false;

  (async () => {
    try {
      const settings = await getSettings();
      if (!settings.githubToken) return sendResponse({ ok: false, error: "Missing GitHub token. Open ShipIt settings." });
      if (!settings.repoFullName) return sendResponse({ ok: false, error: "Missing repo (owner/repo). Open ShipIt settings." });

      const [owner, repo] = settings.repoFullName.split("/");
      const ext = extFromLanguageId(message.payload.languageId);
      const path = renderPath(settings.pathTemplate, { slug: message.payload.slug, ext });

      console.log("[ShipIt Background] Processing push:", {
        slug: message.payload.slug,
        languageId: message.payload.languageId,
        extension: ext,
        path: path
      });

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

      console.log("[ShipIt Background] File exists?", existing.exists, existing.exists ? `SHA: ${existing.sha}` : "");

      if (existing.exists && settings.overwriteMode === "no-overwrite") {
        return sendResponse({ ok: false, error: "File already exists and overwrite is disabled." });
      }

      console.log("[ShipIt Background] Pushing to GitHub:", {
        path,
        branch: settings.branch,
        hasSha: existing.exists,
        overwriteMode: settings.overwriteMode
      });

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
