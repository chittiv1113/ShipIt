# ShipIt (MVP codebase)

ShipIt is a Chrome MV3 extension that detects an **Accepted** result on LeetCode and offers a **Push** button to commit your solution into GitHub via the GitHub Contents API.

## Run
```bash
npm install
npm run build
```

Load into Chrome:
- `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

Configure:
- Open popup → **Open settings**
- Add fine-grained GitHub PAT (Contents: Read/Write on your repo)
- Set repo as `owner/repo`

## MVP caveats
- LeetCode DOM/editor can change; this MVP reads code from Monaco when available.
- Accepted detection is heuristic (searches for exact text "Accepted").
