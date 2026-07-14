import React from "react";
import ReactDOM from "react-dom/client";
import ProductRoot from "./ProductRoot";
import "./styles.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ProductRoot />
    </React.StrictMode>,
  );
}

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {
      // The MVP should still work when service workers are unavailable.
    });
  });
}
