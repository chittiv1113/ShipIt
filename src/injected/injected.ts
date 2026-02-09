/**
 * Runs in the page context (not extension context) so it can access `window.monaco`.
 * Communicates back to content script via window.postMessage.
 */
(() => {
  const readyWindow = window as Window & { __SHIPIT_INJECTED_READY__?: boolean };

  function pickBestModel(monaco: any) {
    const models = monaco?.editor?.getModels?.() ?? [];
    if (!models.length) return null;

    const editors = monaco?.editor?.getEditors?.() ?? [];
    const focusedEditor =
      editors.find((ed: any) => ed?.hasTextFocus?.()) ?? editors.find((ed: any) => ed?.hasWidgetFocus?.());
    const focusedModel = focusedEditor?.getModel?.();
    if (focusedModel) return focusedModel;

    const attachedModels = models.filter((m: any) => {
      try {
        return typeof m?.isAttachedToEditor !== "function" || m.isAttachedToEditor();
      } catch {
        return true;
      }
    });

    const candidates = attachedModels.length ? attachedModels : models;
    return candidates.reduce((best: any, model: any) => {
      const bestLen = (best?.getValue?.() ?? "").trim().length;
      const currentLen = (model?.getValue?.() ?? "").trim().length;
      return currentLen > bestLen ? model : best;
    }, candidates[0]);
  }

  function getMonacoCode(): { code: string; languageId?: string } | null {
    try {
      const w = window as any;
      const monaco = w?.monaco;
      if (!monaco?.editor?.getModels) return null;

      const model = pickBestModel(monaco);
      if (!model) return null;

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
      "*"
    );
  });

  readyWindow.__SHIPIT_INJECTED_READY__ = true;
})();
