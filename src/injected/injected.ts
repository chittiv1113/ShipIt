/**
 * Runs in the page context (not extension context) so it can access `window.monaco`.
 * Communicates back to content script via window.postMessage.
 */
(() => {
  function getMonacoCode(): { code: string; languageId?: string } | null {
    try {
      const w = window as any;
      const monaco = w?.monaco;
      if (!monaco?.editor?.getModels) return null;
      const models = monaco.editor.getModels();
      if (!models?.length) return null;
      const model = models[0];
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
})();
