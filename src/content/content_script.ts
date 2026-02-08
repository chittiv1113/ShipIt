import type { MonacoCodeResponse, PushResponse } from "../shared/types";

const TOAST_ID = "shipit-toast-root";
let toastShownForSlug: string | null = null;

function getSlugFromUrl(): string | null {
  const m = window.location.pathname.match(/^\/problems\/([^\/]+)\/?/);
  return m?.[1] ?? null;
}

function getTitle(): string | undefined {
  const h = document.querySelector("h1, [data-cy='question-title']") as HTMLElement | null;
  const t = h?.innerText?.trim();
  return t || undefined;
}

function ensureInjected(): Promise<void> {
  const id = "shipit-injected-script";
  if (document.getElementById(id)) return Promise.resolve();

  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.id = id;
    s.textContent = `
      (() => {
        function getMonacoCode() {
          try {
            const w = window;
            const monaco = w?.monaco;
            if (!monaco?.editor?.getModels) return null;
            const models = monaco.editor.getModels();
            if (!models?.length) return null;
            // Find the model with the most code (in case multiple editors exist)
            const model = models.reduce((best, m) => {
              const val = m.getValue?.() ?? "";
              const bestVal = best?.getValue?.() ?? "";
              return val.length > bestVal.length ? m : best;
            }, models[0]);
            const code = model.getValue?.() ?? "";
            const languageId = model.getLanguageId?.() ?? undefined;
            return { code, languageId };
          } catch {
            return null;
          }
        }

        window.addEventListener("message", (event) => {
          if (event.source !== window) return;
          if (event.data?.type !== "SHIPIT_GET_CODE") return;

          const res = getMonacoCode();
          window.postMessage(
            {
              type: "SHIPIT_MONACO_CODE",
              payload: res ?? { code: "" }
            },
            window.location.origin
          );
        });
      })();
    `;
    s.onload = () => resolve();
    s.onerror = () => resolve(); // Resolve anyway to not block
    (document.head || document.documentElement).appendChild(s);

    // Resolve immediately since inline scripts execute synchronously
    resolve();
  });
}

function findAccepted(): boolean {
  // Heuristic: look for any element with exact text "Accepted" (LeetCode updates often)
  const nodes = Array.from(document.querySelectorAll("span, div, p"));
  return nodes.some((n) => n.textContent?.trim() === "Accepted");
}

function removeToast() {
  document.getElementById(TOAST_ID)?.remove();
}

function showToast(slug: string) {
  if (document.getElementById(TOAST_ID)) return;

  const root = document.createElement("div");
  root.id = TOAST_ID;

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

  const title = document.createElement("div");
  title.textContent = "✅ Accepted — ShipIt?";
  title.style.fontWeight = "700";
  title.style.fontSize = "14px";

  const sub = document.createElement("div");
  sub.textContent = slug;
  sub.style.marginTop = "4px";
  sub.style.opacity = "0.7";
  sub.style.fontSize = "12px";

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

  dismissBtn.onclick = () => {
    toastShownForSlug = slug;
    removeToast();
  };

  pushBtn.onclick = async () => {
    pushBtn.disabled = true;
    pushBtn.style.opacity = "0.6";
    status.textContent = "Reading code…";
    try {
      await ensureInjected();
      const { code, languageId } = await requestCodeFromMonaco(1200);
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

      toastShownForSlug = slug;
    } catch (e: any) {
      status.textContent = `❌ ${e?.message || "Error"}`;
      pushBtn.disabled = false;
      pushBtn.style.opacity = "1";
    }
  };

  row.appendChild(pushBtn);
  row.appendChild(dismissBtn);

  card.appendChild(title);
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
      reject(new Error("Timed out reading code."));
    }, timeoutMs);

    const onMsg = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as MonacoCodeResponse;
      if (data?.type !== "SHIPIT_MONACO_CODE") return;
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg as any);
      resolve({ code: data.payload.code, languageId: data.payload.languageId });
    };

    window.addEventListener("message", onMsg as any);
    window.postMessage({ type: "SHIPIT_GET_CODE" }, window.location.origin);
  });
}

function boot() {
  const slug = getSlugFromUrl();
  if (!slug) return;

  // Observe changes because LeetCode updates results without full reload
  const obs = new MutationObserver(() => {
    if (toastShownForSlug === slug) return;
    if (findAccepted()) showToast(slug);
  });

  obs.observe(document.documentElement, { childList: true, subtree: true });

  // Also do an initial check
  if (findAccepted()) showToast(slug);
}

boot();
