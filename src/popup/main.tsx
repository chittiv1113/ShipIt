import React from "react";
import ReactDOM from "react-dom/client";

function Popup() {
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
