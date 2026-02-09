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
    cache: 'no-store',
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Cache-Control": "no-cache",
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
}): Promise<{ exists: true; sha: string; size?: number } | { exists: false } | { error: string }> {
  const url = `/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(args.path)}?ref=${encodeURIComponent(args.branch)}`;
  console.log("[GitHub] Fetching existing file SHA:", url);

  const q = await gh<{ sha: string; size?: number }>(
    args.token,
    url
  );
  if (!q.ok) {
    // 404 means doesn't exist
    if (q.status === 404) return { exists: false };
    return { error: `GitHub GET failed (${q.status})` };
  }
  console.log("[GitHub] Found existing file - SHA:", q.data.sha, "Size:", q.data.size);
  return { exists: true, sha: q.data.sha, size: q.data.size };
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

  const url = `/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(args.path)}`;
  console.log("[GitHub] PUT file:", {
    url,
    branch: args.branch,
    sha: args.sha || "(creating new file)",
    contentLength: args.contentUtf8.length,
    messageLength: args.message.length
  });

  const r = await gh<PutContentsResponse>(args.token, url, {
    method: "PUT",
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    let errorMsg = `GitHub PUT failed (${r.status})`;
    try {
      const errorData = JSON.parse(r.text);
      if (errorData.message) {
        errorMsg += `: ${errorData.message}`;
      }
    } catch {
      // If we can't parse the error, just use the status code
    }
    return { ok: false, error: errorMsg };
  }
  return { ok: true, commitSha: r.data.commit?.sha };
}
