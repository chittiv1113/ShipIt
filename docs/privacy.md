# Privacy Policy — ShipIt

Last updated: 2026-02-09

## Summary
ShipIt is a Chrome extension that detects when a LeetCode submission is **Accepted** and, when you choose, helps you **push your solution to a GitHub repository**.

ShipIt does **not** sell your data, does **not** use analytics/trackers, and does **not** use your data for advertising.

## What data ShipIt handles
### 1) Authentication information (GitHub token)
- You may provide a GitHub **fine-grained Personal Access Token (PAT)**.
- This token is used only to write files to the GitHub repository you select.

### 2) Website content (your solution code)
- When you click **Push**, ShipIt reads your solution code from the LeetCode editor and sends it to GitHub to create/update a file in your repo.

### 3) Settings
ShipIt stores the following settings locally:
- GitHub token (PAT)
- GitHub repo (owner/repo)
- Branch name
- Path template (e.g., `leetcode/{slug}/{slug}.{ext}`)
- Overwrite preference

## How data is stored
- All settings (including your GitHub token) are stored **locally on your device** using `chrome.storage.local`.
- ShipIt does **not** sync your token to a server.
- ShipIt does **not** store data in any external database.

## When data is transmitted
ShipIt only communicates with:
- **LeetCode (`leetcode.com`)** — to detect “Accepted” and to read code from the editor when you click **Push**
- **GitHub API (`api.github.com`)** — to create/update files in the repository you configured

ShipIt only sends your solution code to GitHub **when you explicitly click “Push.”**

## Data sharing
- ShipIt does **not** sell your data.
- ShipIt does **not** share your data with third parties for advertising or analytics.
- ShipIt sends data to GitHub only to perform the core feature you request (committing your solution to your repository).

## Data retention & deletion
- You can remove your GitHub token and settings at any time using the **Disconnect** button in ShipIt Settings.
- You can uninstall the extension to remove all locally stored data.
- Any files committed to your GitHub repo are retained according to your GitHub repository history and settings.

## Security
- ShipIt does not intentionally log your GitHub token.
- You should treat your PAT as sensitive and revoke it anytime from GitHub if you believe it’s exposed.

## Changes to this policy
If ShipIt’s data practices change, this policy will be updated and the “Last updated” date will be revised.

## Contact
For support or privacy questions, please open an issue on the project’s support page (GitHub Issues) listed on the Chrome Web Store listing.
