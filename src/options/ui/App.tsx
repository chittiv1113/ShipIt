import React, { useEffect, useMemo, useState } from "react";
import { clearSettings, getSettings, saveSettings } from "../../shared/storage";
import { DEFAULT_SETTINGS, isRepoFullName } from "../../shared/settings";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; msg: string };

export function App() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  const [githubToken, setGithubToken] = useState("");
  const [repoFullName, setRepoFullName] = useState("");
  const [branch, setBranch] = useState(DEFAULT_SETTINGS.branch);
  const [pathTemplate, setPathTemplate] = useState(DEFAULT_SETTINGS.pathTemplate);
  const [overwriteMode, setOverwriteMode] = useState(DEFAULT_SETTINGS.overwriteMode);

  const connected = useMemo(() => !!githubToken.trim() && !!repoFullName.trim(), [githubToken, repoFullName]);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setGithubToken(s.githubToken);
      setRepoFullName(s.repoFullName);
      setBranch(s.branch);
      setPathTemplate(s.pathTemplate);
      setOverwriteMode(s.overwriteMode);
      setStatus({ kind: "idle" });
    })().catch((e) => setStatus({ kind: "error", msg: e?.message || "Failed to load settings" }));
  }, []);

  async function onSave() {
    const repo = repoFullName.trim();
    if (repo && !isRepoFullName(repo)) {
      setStatus({ kind: "error", msg: "Repo must look like owner/repo" });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      await saveSettings({
        githubToken: githubToken.trim(),
        repoFullName: repo,
        branch: branch.trim() || DEFAULT_SETTINGS.branch,
        pathTemplate: pathTemplate.trim() || DEFAULT_SETTINGS.pathTemplate,
        overwriteMode
      });
      setStatus({ kind: "saved" });
      window.setTimeout(() => setStatus({ kind: "idle" }), 1200);
    } catch (e: any) {
      setStatus({ kind: "error", msg: e?.message || "Save failed" });
    }
  }

  async function onDisconnect() {
    setStatus({ kind: "saving" });
    await clearSettings();
    setGithubToken("");
    setRepoFullName("");
    setBranch(DEFAULT_SETTINGS.branch);
    setPathTemplate(DEFAULT_SETTINGS.pathTemplate);
    setOverwriteMode(DEFAULT_SETTINGS.overwriteMode);
    setStatus({ kind: "idle" });
  }

  return (
    <div style={{ padding: 22, maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>ShipIt Settings</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        {connected ? "Connected ✅" : "Not connected"} — ShipIt uses a GitHub fine-grained token with <b>Contents: Read/Write</b>.
      </p>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div>
            <label>GitHub Token (fine-grained PAT)</label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_…"
              autoComplete="off"
            />
            <p className="muted" style={{ marginTop: 8 }}>
              Create a fine-grained PAT scoped to a single repo and enable <b>Contents: Read/Write</b>.
            </p>
          </div>

          <div>
            <label>Repo (owner/repo)</label>
            <input value={repoFullName} onChange={(e) => setRepoFullName(e.target.value)} placeholder="Owner/leetcode" />
            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <label>Branch</label>
                <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
              </div>
              <div>
                <label>Overwrite</label>
                <select value={overwriteMode} onChange={(e) => setOverwriteMode(e.target.value as any)}>
                  <option value="overwrite">Overwrite existing</option>
                  <option value="no-overwrite">Fail if exists</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Path template</label>
          <input value={pathTemplate} onChange={(e) => setPathTemplate(e.target.value)} />
          <p className="muted" style={{ marginTop: 8 }}>
            Use <code>{"{slug}"}</code> and <code>{"{ext}"}</code>. Default: <code>{DEFAULT_SETTINGS.pathTemplate}</code>
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn btn-primary" onClick={onSave} disabled={status.kind === "saving"}>
            Save
          </button>
          <button className="btn btn-danger" onClick={onDisconnect} disabled={status.kind === "saving"}>
            Disconnect
          </button>
        </div>

        <div className="status">
          {status.kind === "loading" && "Loading…"}
          {status.kind === "saving" && "Working…"}
          {status.kind === "saved" && "Saved ✅"}
          {status.kind === "error" && <span style={{ color: "#dc2626" }}>{status.msg}</span>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>How to use</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Go to any LeetCode problem page, submit a solution, and when the result shows <b>Accepted</b>, ShipIt will pop a toast to push it.
        </p>
      </div>
    </div>
  );
}
