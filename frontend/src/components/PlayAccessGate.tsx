import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function PlayAccessGate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timeoutRef = useRef<number | null>(null);
  const [leavingTarget, setLeavingTarget] = useState<"/login" | "/register" | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleNavigate = (target: "/login" | "/register") => {
    if (leavingTarget) return;
    setLeavingTarget(target);
    timeoutRef.current = window.setTimeout(() => navigate(target), 420);
  };

  return (
    <div className="app-container play-route-shell play-route-shell-center">
      <div className={`glass-panel play-hub-panel play-hub-panel-enter play-access-panel${leavingTarget ? " play-access-panel-leaving" : ""}`}>
        <div className="play-access-inner">
          <div className="main-menu-kicker">{t("READY TO ENTER")}</div>
          <h1 className="title-glow main-menu-options-title">NEON PONG</h1>
          <p className="play-access-copy">{t("LOGIN_GATE_COPY")}</p>

          <div className="play-access-actions">
            <button className="btn-premium" type="button" onClick={() => handleNavigate("/login")}>
              {t("LOGIN")}
            </button>
            <button className="btn-premium secondary" type="button" onClick={() => handleNavigate("/register")}>
              {t("REGISTER")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
