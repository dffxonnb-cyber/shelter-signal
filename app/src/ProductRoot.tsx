import { useEffect, useState } from "react";
import App from "./App";
import ChangeDashboard from "./ChangeDashboard";
import NoticeTimelinePage from "./NoticeTimelinePage";
import "./v2.css";
import "./timeline.css";

type ProductRoute =
  | { mode: "live" }
  | { mode: "changes" }
  | { mode: "timeline"; noticeKey: string };

export default function ProductRoot() {
  const [route, setRoute] = useState<ProductRoute>(() => routeFromHash());

  useEffect(() => {
    const handleHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const changeMode = (mode: "live" | "changes") => {
    window.location.hash = mode === "changes" ? "#changes" : "#live";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const v2Active = route.mode === "changes" || route.mode === "timeline";

  return (
    <div className={`product-root mode-${route.mode}`}>
      <div className="mode-switch-shell">
        <nav className="mode-switch" aria-label="Shelter Signal 버전 선택">
          <button
            type="button"
            className={route.mode === "live" ? "is-active" : ""}
            aria-current={route.mode === "live" ? "page" : undefined}
            onClick={() => changeMode("live")}
          >
            <span>V1</span>
            현재 공고
          </button>
          <button
            type="button"
            className={v2Active ? "is-active" : ""}
            aria-current={v2Active ? "page" : undefined}
            onClick={() => changeMode("changes")}
          >
            <span>V2</span>
            변화 추적
          </button>
        </nav>
      </div>

      {route.mode === "live" && <App />}
      {route.mode === "changes" && <ChangeDashboard />}
      {route.mode === "timeline" && <NoticeTimelinePage noticeKey={route.noticeKey} />}
    </div>
  );
}

function routeFromHash(): ProductRoute {
  const hash = window.location.hash;
  if (hash.startsWith("#timeline/")) {
    const encodedKey = hash.slice("#timeline/".length);
    try {
      const noticeKey = decodeURIComponent(encodedKey);
      if (noticeKey) return { mode: "timeline", noticeKey };
    } catch {
      return { mode: "changes" };
    }
  }
  return hash.toLowerCase() === "#changes" ? { mode: "changes" } : { mode: "live" };
}
