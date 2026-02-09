export type OverwriteMode = "overwrite" | "no-overwrite";

export type MonacoCodeResponse = {
  type: "SHIPIT_MONACO_CODE";
  payload: { code: string; languageId?: string };
};

export type PushRequest = {
  type: "SHIPIT_PUSH";
  payload: {
    slug: string;
    url: string;
    title?: string;
    languageId?: string; // e.g. "python", "javascript"
    code: string;
  };
};

export type OpenSettingsRequest = {
  type: "SHIPIT_OPEN_SETTINGS";
};

export type ShipItRequest = PushRequest | OpenSettingsRequest;

export type PushResponse =
  | { ok: true; path: string; commitUrl?: string }
  | { ok: false; error: string };

export type OpenSettingsResponse = { ok: true } | { ok: false; error: string };

export type ShipItResponse = PushResponse | OpenSettingsResponse;
