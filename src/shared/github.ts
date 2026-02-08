export type PutContentsResponse = {
  content?: { path?: string };
  commit?: { sha?: string };
};

function base64EncodeUtf8(s: string): string {
  // btoa doesn't accept unicode directly
  return btoa(unescape(encodeURIComponent(s)));
}

async function gh<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      ...(init?.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, text };
  return { ok: true, data: (text ? (JSON.parse(text) as T) : ({} as T)) };
}

export async function getExistingFileSha(args: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}): Promise<{ exists: true; sha: string } | { exists: false } | { error: string }> {
  const q = await gh<{ sha: string }>(
    args.token,
    `/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(args.path)}?ref=${encodeURIComponent(args.branch)}`
  );
  if (!q.ok) {
    // 404 means doesn't exist
    if (q.status === 404) return { exists: false };
    return { error: `GitHub GET failed (${q.status})` };
  }
  return { exists: true, sha: q.data.sha };
}

export async function putFile(args: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  message: string;
  contentUtf8: string;
  sha?: string;
}): Promise<{ ok: true; commitSha?: string } | { ok: false; error: string }> {
  const body: any = {
    message: args.message,
    content: base64EncodeUtf8(args.contentUtf8),
    branch: args.branch
  };
  if (args.sha) body.sha = args.sha;

  const r = await gh<PutContentsResponse>(args.token, `/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(args.path)}`, {
    method: "PUT",
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    return { ok: false, error: `GitHub PUT failed (${r.status})` };
  }
  return { ok: true, commitSha: r.data.commit?.sha };
}
