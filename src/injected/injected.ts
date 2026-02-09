// @ts-nocheck
/**
 * Runs in the page context (not extension context) so it can access page globals.
 * IMPORTANT: this file is loaded as a raw script, so it must stay plain JavaScript.
 */
(() => {
  const shipitWindow = window;
  let lastSubmission = null;

  const TERMINAL_FAILURE_STATUSES = new Set([
    "wrong answer",
    "runtime error",
    "time limit exceeded",
    "memory limit exceeded",
    "output limit exceeded",
    "compile error",
    "internal error",
    "presentation error"
  ]);

  function normalize(text) {
    return (text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function extractSubmissionId(url) {
    const match = url.match(/\/submissions\/detail\/(\d+)/);
    return match?.[1];
  }

  function extractProblemSlug(url) {
    const match = url.match(/\/problems\/([^/]+)\//);
    return match?.[1];
  }

  function isSubmissionStartUrl(url) {
    const normalizedUrl = String(url).toLowerCase();
    if (/\/problems\/[^/]+\/submit\/?$/.test(normalizedUrl)) return true;
    return normalizedUrl.includes("/submit/");
  }

  function isSubmissionResultUrl(url) {
    const normalizedUrl = String(url).toLowerCase();
    return (
      normalizedUrl.includes("/submissions/detail/") ||
      normalizedUrl.includes("/submissions/") ||
      normalizedUrl.includes("/check/")
    );
  }

  function payloadFromBody(body) {
    if (!body) return null;

    if (typeof body === "string") {
      const asJson = parseJson(body);
      if (asJson && typeof asJson === "object") return asJson;

      const params = new URLSearchParams(body);
      if ([...params.keys()].length) return Object.fromEntries(params.entries());
      return null;
    }

    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
      return Object.fromEntries(body.entries());
    }

    if (typeof FormData !== "undefined" && body instanceof FormData) {
      const payload = {};
      for (const [key, value] of body.entries()) {
        if (typeof value === "string") payload[key] = value;
      }
      return payload;
    }

    return null;
  }

  function parseLanguageFromPayload(payload) {
    const candidates = [payload?.lang, payload?.language, payload?.language_id];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
    return undefined;
  }

  function captureSubmissionCode(url, body) {
    const payload = payloadFromBody(body);
    if (!payload || typeof payload !== "object") return;

    const codeCandidate = payload.typed_code ?? payload.code;
    if (typeof codeCandidate !== "string" || !codeCandidate.trim()) return;

    lastSubmission = {
      slug: extractProblemSlug(url),
      code: codeCandidate,
      languageId: parseLanguageFromPayload(payload),
      capturedAt: Date.now()
    };
  }

  async function captureSubmissionCodeFromFetchArgs(args, requestUrl) {
    const request = args[0];
    const init = args[1];

    if (init && typeof init === "object" && "body" in init) {
      captureSubmissionCode(requestUrl, init.body);
      return;
    }

    if (typeof Request !== "undefined" && request instanceof Request) {
      try {
        const bodyText = await request.clone().text();
        captureSubmissionCode(requestUrl, bodyText);
      } catch {
        // Body may be unavailable; ignore.
      }
    }
  }

  function emitSubmissionStarted() {
    const now = Date.now();
    if (shipitWindow.__SHIPIT_LAST_SUBMIT_START_AT__ && now - shipitWindow.__SHIPIT_LAST_SUBMIT_START_AT__ < 250) {
      return;
    }

    shipitWindow.__SHIPIT_LAST_SUBMIT_START_AT__ = now;
    window.postMessage({ type: "SHIPIT_SUBMISSION_STARTED" }, "*");
  }

  function emitSubmissionResult(status, submissionId) {
    const normalizedStatus = normalize(status);
    if (!normalizedStatus) return;
    if (normalizedStatus !== "accepted" && !TERMINAL_FAILURE_STATUSES.has(normalizedStatus)) return;

    const key = `${submissionId ?? "unknown"}:${normalizedStatus}`;
    if (shipitWindow.__SHIPIT_LAST_RESULT_KEY__ === key) return;
    shipitWindow.__SHIPIT_LAST_RESULT_KEY__ = key;

    window.postMessage(
      {
        type: "SHIPIT_SUBMISSION_RESULT",
        payload: { status: normalizedStatus, submissionId }
      },
      "*"
    );
  }

  function maybeEmitFromResponse(url, body) {
    if (!isSubmissionResultUrl(url)) return;
    if (!body || typeof body !== "object") return;

    const data = body;
    const statusCandidates = [
      typeof data.status_msg === "string" ? data.status_msg : "",
      typeof data.statusMsg === "string" ? data.statusMsg : "",
      typeof data.state === "string" ? data.state : "",
      typeof data.status_code === "string" ? data.status_code : "",
      typeof data.statusCode === "string" ? data.statusCode : ""
    ];

    const status = statusCandidates.find((value) => !!normalize(value));
    if (!status) return;

    emitSubmissionResult(status, extractSubmissionId(url));
  }

  function patchFetch() {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const request = args[0];
        const requestUrl =
          typeof request === "string" ? request : request instanceof URL ? request.toString() : request.url;

        if (isSubmissionStartUrl(requestUrl)) {
          await captureSubmissionCodeFromFetchArgs(args, requestUrl);
          emitSubmissionStarted();
        }

        if (isSubmissionResultUrl(requestUrl)) {
          response
            .clone()
            .json()
            .then((json) => maybeEmitFromResponse(requestUrl, json))
            .catch(() => undefined);
        }
      } catch {
        // Ignore hook errors to avoid breaking page requests.
      }

      return response;
    };
  }

  function patchXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, async, username, password) {
      this.__shipitUrl__ = typeof url === "string" ? url : url.toString();
      return originalOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const requestUrl = this.__shipitUrl__ ?? "";
      if (isSubmissionStartUrl(requestUrl)) {
        captureSubmissionCode(requestUrl, body);
        emitSubmissionStarted();
      }

      this.addEventListener("load", () => {
        if (!isSubmissionResultUrl(requestUrl)) return;

        const parsed = parseJson(this.responseText);
        if (parsed === null) return;

        maybeEmitFromResponse(requestUrl, parsed);
      });

      return originalSend.call(this, body ?? null);
    };
  }

  function ensureNetworkHooks() {
    if (shipitWindow.__SHIPIT_NET_PATCHED__) return;
    shipitWindow.__SHIPIT_NET_PATCHED__ = true;

    patchFetch();
    patchXHR();
  }

  function pickBestModel(monaco) {
    const models = monaco?.editor?.getModels?.() ?? [];
    if (!models.length) return null;

    const editors = monaco?.editor?.getEditors?.() ?? [];
    const focusedEditor = editors.find((ed) => ed?.hasTextFocus?.()) ?? editors.find((ed) => ed?.hasWidgetFocus?.());
    const focusedModel = focusedEditor?.getModel?.();
    if (focusedModel) return focusedModel;

    const attachedModels = models.filter((model) => {
      try {
        return typeof model?.isAttachedToEditor !== "function" || model.isAttachedToEditor();
      } catch {
        return true;
      }
    });

    const candidates = attachedModels.length ? attachedModels : models;
    return candidates.reduce((best, model) => {
      const bestLen = (best?.getValue?.() ?? "").trim().length;
      const currentLen = (model?.getValue?.() ?? "").trim().length;
      return currentLen > bestLen ? model : best;
    }, candidates[0]);
  }

  function getMonacoCode() {
    const currentSlug = extractProblemSlug(window.location.pathname);
    const canUseCachedSubmission =
      !!lastSubmission && (!currentSlug || !lastSubmission.slug || currentSlug === lastSubmission.slug);

    try {
      const monaco = window?.monaco;
      if (!monaco?.editor?.getModels) {
        if (canUseCachedSubmission) {
          return { code: lastSubmission.code, languageId: lastSubmission.languageId };
        }
        return null;
      }

      const model = pickBestModel(monaco);
      if (!model) {
        if (canUseCachedSubmission) {
          return { code: lastSubmission.code, languageId: lastSubmission.languageId };
        }
        return null;
      }

      const code = model.getValue?.() ?? "";
      const languageId = model.getLanguageId?.() ?? undefined;

      if (!code.trim() && canUseCachedSubmission) {
        return { code: lastSubmission.code, languageId: lastSubmission.languageId ?? languageId };
      }

      return { code, languageId };
    } catch {
      if (canUseCachedSubmission) {
        return { code: lastSubmission.code, languageId: lastSubmission.languageId };
      }
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
      "*"
    );
  });

  ensureNetworkHooks();
  shipitWindow.__SHIPIT_INJECTED_READY__ = true;
})();
