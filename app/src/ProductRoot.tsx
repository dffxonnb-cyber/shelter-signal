import { useEffect, useState } from "react";
import App from "./App";
import ChangeDashboard from "./ChangeDashboard";
import "./v2.css";

type ProductMode = "live" | "changes";

export default function ProductRoot() {
  const [mode, setMode] = useState<ProductMode>(() => modeFromHash());

  useEffect(() => {
    const handleHashChange = () => setMode(modeFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const changeMode = (nextMode: ProductMode) => {
    const nextHash = nextMode === "changes" ? "#changes" : "#live";
    window.history.replaceState(null, "", nextHash);
    setMode(nextMode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={`product-root mode-${mode}`}>
      <div className="mode-switch-shell">
        <nav className="mode-switch" aria-label="Shelter Signal 버전 선택">
          <button
            type="button"
            className={mode === "live" ? "is-active" : ""}
            aria-current={mode === "live" ? "page" : undefined}
            onClick={() => changeMode("live")}
          >
            <span>V1</span>
            현재 공고
          </button>
          <button
            type="button"
            className={mode === "changes" ? "is-active" : ""}
            aria-current={mode === "changes" ? "page" : undefined}
            onClick={() => changeMode("changes")}
          >
            <span>V2</span>
            변화 추적
          </button>
        </nav>
      </div>

      {mode === "live" ? <App /> : <ChangeDashboard />}
    </div>
  );
}

function modeFromHash(): ProductMode {
  return window.location.hash.toLowerCase() === "#changes" ? "changes" : "live";
}
