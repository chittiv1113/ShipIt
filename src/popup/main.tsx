import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";

function Popup() {
  useEffect(() => {
    const openToast = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id === undefined) return;

        await chrome.tabs.sendMessage(tab.id, { type: "SHIPIT_OPEN_TOAST" });
      } catch {
        // Ignore silently when not on a supported tab/page.
      }
    };

    void openToast();
  }, []);

  return (
    <div className="wrap">
      <p className="title">ShipIt</p>
      <p className="muted">
        When LeetCode says <b>Accepted</b>, ShipIt offers a Push button to commit your solution to GitHub.
      </p>
      <button
        onClick={() => {
          chrome.runtime.openOptionsPage();
        }}
      >
        Open settings
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
