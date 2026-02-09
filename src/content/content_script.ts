import type { MonacoCodeResponse, PushResponse } from "../shared/types";

const TOAST_ID = "shipit-toast-root";
const TOAST_LAUNCHER_ID = "shipit-toast-launcher";
let toastShownForSlug: string | null = null;
let activeSlug: string | null = null;
let activeRouteKey: string | null = null;
let injectedReadyPromise: Promise<void> | null = null;

function getSlugFromUrl(): string | null {
  const m = window.location.pathname.match(/^\/problems\/([^\/]+)\/?/);
  return m?.[1] ?? null;
}

function getTitle(): string | undefined {
  const h = document.querySelector("h1, [data-cy='question-title']") as HTMLElement | null;
  const t = h?.innerText?.trim();
  return t || undefined;
}

function isInjectedReady(): boolean {
  return !!(window as Window & { __SHIPIT_INJECTED_READY__?: boolean }).__SHIPIT_INJECTED_READY__;
}

function waitForInjectedReady(timeoutMs: number): Promise<void> {
  if (isInjectedReady()) return Promise.resolve();

  return new Promise((resolve) => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      if (isInjectedReady() || Date.now() - start >= timeoutMs) {
        window.clearInterval(timer);
        resolve();
      }
    }, 25);
  });
}

function ensureInjected(): Promise<void> {
  if (isInjectedReady()) return Promise.resolve();
  if (injectedReadyPromise) return injectedReadyPromise;

  const id = "shipit-injected-script";
  const existing = document.getElementById(id);
  if (existing) {
    injectedReadyPromise = waitForInjectedReady(2000);
    return injectedReadyPromise;
  }

  injectedReadyPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.id = id;
    s.src = chrome.runtime.getURL("src/injected/injected.ts");
    s.onload = async () => {
      await waitForInjectedReady(2000);
      resolve();
    };
    s.onerror = (e) => {
      console.error("[ShipIt] Script injection error:", e);
      resolve(); // Resolve anyway to not block
    };

    try {
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      console.error("[ShipIt] Failed to inject script:", e);
      resolve();
    }
  });

  return injectedReadyPromise;
}

function findAccepted(): boolean {
  // Heuristic: look for any element with exact text "Accepted" (LeetCode updates often)
  const nodes = Array.from(document.querySelectorAll("span, div, p"));
  return nodes.some((n) => n.textContent?.trim() === "Accepted");
}

function removeToast() {
  document.getElementById(TOAST_ID)?.remove();
}

function removeToastLauncher() {
  document.getElementById(TOAST_LAUNCHER_ID)?.remove();
}

function showToastLauncher(slug: string) {
  const existing = document.getElementById(TOAST_LAUNCHER_ID);
  if (existing) {
    const existingSlug = existing.getAttribute("data-shipit-slug");
    if (existingSlug === slug) return;
    existing.remove();
  }

  const launcher = document.createElement("button");
  launcher.id = TOAST_LAUNCHER_ID;
  launcher.setAttribute("data-shipit-slug", slug);
  launcher.textContent = "ShipIt";
  launcher.style.position = "fixed";
  launcher.style.right = "18px";
  launcher.style.bottom = "18px";
  launcher.style.zIndex = "2147483647";
  launcher.style.border = "1px solid rgba(0,0,0,0.14)";
  launcher.style.borderRadius = "999px";
  launcher.style.padding = "8px 12px";
  launcher.style.background = "white";
  launcher.style.color = "#1a1a1a";
  launcher.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  launcher.style.fontSize = "12px";
  launcher.style.fontWeight = "600";
  launcher.style.boxShadow = "0 8px 20px rgba(0,0,0,0.16)";
  launcher.style.cursor = "pointer";
  launcher.onmouseenter = () => (launcher.style.background = "#f7f7f7");
  launcher.onmouseleave = () => (launcher.style.background = "white");
  launcher.onclick = () => {
    toastShownForSlug = null;
    removeToastLauncher();
    showToast(slug);
  };

  document.documentElement.appendChild(launcher);
}

function showToast(slug: string) {
  removeToastLauncher();

  const existing = document.getElementById(TOAST_ID);
  if (existing) {
    const existingSlug = existing.getAttribute("data-shipit-slug");
    if (existingSlug === slug) return;
    existing.remove();
  }

  const root = document.createElement("div");
  root.id = TOAST_ID;
  root.setAttribute("data-shipit-slug", slug);

  // Minimal inline styles (no build-time CSS)
  root.style.position = "fixed";
  root.style.right = "18px";
  root.style.bottom = "18px";
  root.style.zIndex = "2147483647";
  root.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

  const card = document.createElement("div");
  card.style.width = "340px";
  card.style.border = "1px solid rgba(0,0,0,0.12)";
  card.style.borderRadius = "14px";
  card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.18)";
  card.style.background = "white";
  card.style.padding = "14px";
  card.style.position = "relative";

  // Header with title and action icons
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "flex-start";

  const title = document.createElement("div");
  title.textContent = "Accepted? — ShipIt!";
  title.style.fontWeight = "700";
  title.style.fontSize = "14px";
  title.style.color = "#1a1a1a";

  const headerActions = document.createElement("div");
  headerActions.style.display = "flex";
  headerActions.style.gap = "8px";
  headerActions.style.alignItems = "center";

  const settingsIcon = document.createElement("div");
  settingsIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>`;
  settingsIcon.style.cursor = "pointer";
  settingsIcon.style.opacity = "0.6";
  settingsIcon.style.color = "#1a1a1a";
  settingsIcon.style.transition = "opacity 0.2s";
  settingsIcon.onmouseenter = () => (settingsIcon.style.opacity = "1");
  settingsIcon.onmouseleave = () => (settingsIcon.style.opacity = "0.6");
  settingsIcon.onclick = async () => {
    try {
      const response = (await chrome.runtime.sendMessage({ type: "SHIPIT_OPEN_SETTINGS" })) as { ok?: boolean; error?: string } | undefined;
      if (response?.ok) return;
    } catch {
      // Fall through to URL fallback.
    }

    window.open(chrome.runtime.getURL("src/options/index.html"), "_blank", "noopener,noreferrer");
  };

  // Reload icon (hidden by default, shown after successful push)
  const reloadIcon = document.createElement("div");
  reloadIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
  reloadIcon.style.cursor = "pointer";
  reloadIcon.style.display = "none";
  reloadIcon.style.opacity = "0.6";
  reloadIcon.style.color = "#1a1a1a";
  reloadIcon.style.transition = "opacity 0.2s";
  reloadIcon.onmouseenter = () => (reloadIcon.style.opacity = "1");
  reloadIcon.onmouseleave = () => (reloadIcon.style.opacity = "0.6");
  reloadIcon.onclick = () => {
    toastShownForSlug = null;
    removeToast();
  };

  header.appendChild(title);
  headerActions.appendChild(settingsIcon);
  headerActions.appendChild(reloadIcon);
  header.appendChild(headerActions);

  const sub = document.createElement("div");
  sub.textContent = slug;
  sub.style.marginTop = "4px";
  sub.style.opacity = "0.7";
  sub.style.fontSize = "12px";
  sub.style.color = "#1a1a1a";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "10px";
  row.style.marginTop = "12px";

  const btn = (label: string) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.flex = "1";
    b.style.border = "1px solid rgba(0,0,0,0.14)";
    b.style.borderRadius = "12px";
    b.style.padding = "10px 12px";
    b.style.cursor = "pointer";
    b.style.background = "white";
    b.style.color = "#1a1a1a";
    b.style.fontSize = "13px";
    b.style.fontWeight = "500";
    b.onmouseenter = () => (b.style.background = "#f7f7f7");
    b.onmouseleave = () => (b.style.background = "white");
    return b;
  };

  const pushBtn = btn("Push");
  const dismissBtn = btn("Dismiss");

  const status = document.createElement("div");
  status.style.marginTop = "10px";
  status.style.fontSize = "12px";
  status.style.opacity = "0.8";
  status.style.color = "#1a1a1a";

  dismissBtn.onclick = () => {
    toastShownForSlug = slug;
    removeToast();
    showToastLauncher(slug);
  };

  pushBtn.onclick = async () => {
    pushBtn.disabled = true;
    pushBtn.style.opacity = "0.6";
    status.textContent = "Reading code…";
    try {
      await ensureInjected();
      const { code, languageId } = await requestCodeFromMonaco(3000); // Increased timeout to 3 seconds
      if (!code || !code.trim()) throw new Error("Could not read code from editor (Monaco).");

      status.textContent = "Pushing to GitHub…";

      const resp = (await chrome.runtime.sendMessage({
        type: "SHIPIT_PUSH",
        payload: {
          slug,
          url: window.location.href,
          title: getTitle(),
          languageId,
          code
        }
      })) as PushResponse;

      if (!resp?.ok) throw new Error(resp?.error || "Push failed");
      status.textContent = `✅ Pushed: ${resp.path}`;

      // Add a small link if commit URL is available
      if (resp.commitUrl) {
        const a = document.createElement("a");
        a.href = resp.commitUrl;
        a.textContent = "View commit";
        a.target = "_blank";
        a.rel = "noreferrer";
        a.style.display = "inline-block";
        a.style.marginTop = "6px";
        a.style.fontSize = "12px";
        a.style.color = "#2563eb";
        status.appendChild(document.createElement("br"));
        status.appendChild(a);
      }

      // Show reload icon after successful push
      reloadIcon.style.display = "block";

      toastShownForSlug = slug;
    } catch (e: any) {
      status.textContent = `❌ ${e?.message || "Error"}`;
      pushBtn.disabled = false;
      pushBtn.style.opacity = "1";
    }
  };

  row.appendChild(pushBtn);
  row.appendChild(dismissBtn);

  card.appendChild(header);
  card.appendChild(sub);
  card.appendChild(row);
  card.appendChild(status);
  root.appendChild(card);
  document.documentElement.appendChild(root);
}

function requestCodeFromMonaco(timeoutMs: number): Promise<{ code: string; languageId?: string }> {
  return new Promise((resolve, reject) => {
    let done = false;

    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg as any);
      console.log("[ShipIt] Monaco timeout, trying DOM fallback...");

      // Fallback: try to read from DOM
      const fallbackCode = tryGetCodeFromDOM();
      const fallbackLang = getLanguageFromUI();
      if (fallbackCode) {
        console.log("[ShipIt] Using fallback - code:", fallbackCode.length, "chars, lang:", fallbackLang);
        resolve({ code: fallbackCode, languageId: fallbackLang });
      } else {
        reject(new Error("Could not read code from editor. Try copying your code manually."));
      }
    }, timeoutMs);

    const onMsg = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as MonacoCodeResponse;
      if (data?.type !== "SHIPIT_MONACO_CODE") return;
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg as any);
      console.log("[ShipIt] Got code from Monaco:", data.payload.code?.length, "chars");
      resolve({ code: data.payload.code, languageId: data.payload.languageId });
    };

    window.addEventListener("message", onMsg as any);
    console.log("[ShipIt] Requesting code from Monaco...");
    window.postMessage({ type: "SHIPIT_GET_CODE" }, "*");
  });
}

function getLanguageFromUI(): string | undefined {
  try {
    // Method 1: Try to get from data attributes on Monaco editor
    const monacoEl = document.querySelector('[data-mode-id]');
    if (monacoEl) {
      const modeId = monacoEl.getAttribute('data-mode-id');
      if (modeId) {
        console.log("[ShipIt] Found language from data-mode-id:", modeId);
        return modeId;
      }
    }

    // Method 2: Look for language selector button text
    // LeetCode typically has a button showing the current language
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase() || '';
      // Look for language keywords in buttons
      if (text.match(/^(python|javascript|typescript|java|c\+\+|c#|go|kotlin|swift|ruby|rust|php|scala|cpp|csharp)$/i)) {
        console.log("[ShipIt] Found language from button:", text);
        return text.replace('c++', 'cpp').replace('c#', 'csharp');
      }
      // Check for "Python3", "JavaScript" etc with version numbers
      if (text.match(/^(python3|javascript|typescript)/i)) {
        console.log("[ShipIt] Found language from button:", text);
        return text;
      }
    }

    // Method 3: Check URL or page for hints
    const pathMatch = window.location.pathname.match(/lang=([^&/]+)/);
    if (pathMatch) {
      console.log("[ShipIt] Found language from URL:", pathMatch[1]);
      return pathMatch[1];
    }

    // Method 4: Look for divs/spans that might contain language info
    const allText = Array.from(document.querySelectorAll('div, span, button'))
      .map(el => el.textContent?.trim().toLowerCase() || '')
      .filter(t => t.length < 20); // Only short text snippets

    for (const text of allText) {
      if (text === 'python' || text === 'python3') return 'python3';
      if (text === 'javascript') return 'javascript';
      if (text === 'typescript') return 'typescript';
      if (text === 'java' && !text.includes('javascript')) return 'java';
      if (text === 'c++' || text === 'cpp') return 'cpp';
      if (text === 'c#' || text === 'csharp') return 'csharp';
    }

    console.log("[ShipIt] Could not detect language from UI");
    return undefined;
  } catch (e) {
    console.error("[ShipIt] Language detection error:", e);
    return undefined;
  }
}

function tryGetCodeFromDOM(): string | null {
  try {
    // Method 1: Try Monaco's view-lines (extract line by line to preserve formatting)
    const viewLinesContainer = document.querySelector('.monaco-editor .view-lines');
    if (viewLinesContainer) {
      const linesContent = document.querySelector(".monaco-editor .lines-content") as HTMLElement | null;
      const appearsVirtualized = !!linesContent && linesContent.scrollHeight > linesContent.clientHeight + 4;

      if (appearsVirtualized) {
        console.log("[ShipIt] Monaco fallback skipped: editor is scrollable, visible lines would be partial.");
      } else {
      // Get direct children only to avoid duplicates from overlays
        const lineElements = Array.from(viewLinesContainer.children).filter(
          el => el.classList.contains('view-line') || el.className.includes('view-line')
        );

        if (lineElements.length > 0) {
          const orderedLineElements = lineElements
            .map((line) => {
              const rect = (line as HTMLElement).getBoundingClientRect();
              return { line, top: rect.top, left: rect.left };
            })
            .sort((a, b) => {
              if (Math.abs(a.top - b.top) > 0.5) return a.top - b.top;
              return a.left - b.left;
            })
            .map((entry) => entry.line);

          const code = orderedLineElements.map(line => {
            // Get innerText which preserves spacing better than textContent
            const text = (line as HTMLElement).innerText || line.textContent || '';
            return text;
          }).join('\n');

          if (code.trim().length > 10) {
            console.log("[ShipIt] Extracted code from Monaco view-lines:", lineElements.length, "lines");
            return code;
          }
        }
      }
    }

    // Method 2: Try CodeMirror
    const codeMirror = document.querySelector('.CodeMirror-code');
    if (codeMirror) {
      const lines = Array.from(codeMirror.querySelectorAll('.CodeMirror-line'));
      if (lines.length > 0) {
        const code = lines.map(line => line.textContent || '').join('\n');
        if (code.trim().length > 10) {
          console.log("[ShipIt] Extracted code from CodeMirror:", lines.length, "lines");
          return code;
        }
      }
    }

    // Method 3: Try textarea
    const textarea = document.querySelector('textarea[name*="code"]') as HTMLTextAreaElement;
    if (textarea?.value && textarea.value.trim().length > 10) {
      console.log("[ShipIt] Extracted code from textarea");
      return textarea.value;
    }

    // Method 4: Try contenteditable
    const editable = document.querySelector('div[contenteditable="true"]');
    if (editable?.textContent && editable.textContent.trim().length > 10) {
      console.log("[ShipIt] Extracted code from contenteditable");
      return editable.textContent;
    }

    console.log("[ShipIt] Could not extract code from DOM");
    return null;
  } catch (e) {
    console.error("[ShipIt] DOM fallback error:", e);
    return null;
  }
}

function openToastForCurrentProblem(): { ok: true } | { ok: false; error: string } {
  const slug = getSlugFromUrl();
  if (!slug) {
    return { ok: false, error: "Not on a LeetCode problem page." };
  }

  activeSlug = slug;
  activeRouteKey = `${window.location.pathname}${window.location.search}`;
  toastShownForSlug = null;
  removeToastLauncher();
  showToast(slug);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SHIPIT_OPEN_TOAST") return false;

  sendResponse(openToastForCurrentProblem());
  return false;
});

function boot() {
  const getRouteKey = () => `${window.location.pathname}${window.location.search}`;

  const notifyRouteChange = () => {
    window.dispatchEvent(new Event("shipit-route-change"));
  };

  const patchHistoryMethod = (method: "pushState" | "replaceState") => {
    const original = history[method];

    history[method] = function (...args: Parameters<History["pushState"]>) {
      const result = original.apply(history, args);
      notifyRouteChange();
      return result;
    } as History["pushState"];
  };

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
  window.addEventListener("popstate", notifyRouteChange);

  const refreshForCurrentRoute = () => {
    const routeKey = getRouteKey();
    if (routeKey === activeRouteKey) return;
    activeRouteKey = routeKey;

    const slug = getSlugFromUrl();
    if (slug === activeSlug) return;

    activeSlug = slug;
    removeToast();
    removeToastLauncher();
    if (!slug) return;

    if (toastShownForSlug !== slug && findAccepted()) {
      showToast(slug);
    }
  };

  window.addEventListener("shipit-route-change", refreshForCurrentRoute);

  // LeetCode can navigate without firing reliable history/popstate hooks in content-script context.
  // Poll the route key so we always refresh toast context on problem switches.
  window.setInterval(refreshForCurrentRoute, 400);

  // Observe changes because LeetCode updates results without full reload
  const obs = new MutationObserver(() => {
    const slug = getSlugFromUrl();
    if (!slug) return;

    if (slug !== activeSlug) {
      activeSlug = slug;
      removeToast();
      removeToastLauncher();
    }

    if (toastShownForSlug === slug) return;
    if (findAccepted()) showToast(slug);
  });

  obs.observe(document.documentElement, { childList: true, subtree: true });

  refreshForCurrentRoute();
}

boot();
