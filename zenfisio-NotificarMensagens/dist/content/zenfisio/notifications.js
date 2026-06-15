let host = null;
const ensureHost = () => {
    if (host && host.isConnected) {
        return host;
    }
    host = document.createElement("div");
    host.style.cssText = [
        "position:fixed",
        "bottom:16px",
        "left:50%",
        "transform:translateX(-50%)",
        "display:grid",
        "gap:8px",
        "z-index:2147483647",
        "pointer-events:none"
    ].join(";");
    document.body.appendChild(host);
    return host;
};
export const showToast = (message, variant = "ok") => {
    if (!message) {
        return;
    }
    const container = ensureHost();
    const item = document.createElement("div");
    const bg = variant === "ok"
        ? "#1f7a3f"
        : variant === "warn"
            ? "#8a6100"
            : "#9b1c1c";
    item.style.cssText = [
        "pointer-events:auto",
        "font-family:Segoe UI, Arial, sans-serif",
        "font-size:12px",
        "font-weight:600",
        "color:#fff",
        "background:" + bg,
        "border-radius:10px",
        "padding:10px 14px",
        "box-shadow:0 10px 22px rgba(0,0,0,0.28)",
        "opacity:0",
        "transform:translateY(8px)",
        "transition:opacity 180ms ease, transform 180ms ease"
    ].join(";");
    item.textContent = message;
    container.appendChild(item);
    requestAnimationFrame(() => {
        item.style.opacity = "1";
        item.style.transform = "translateY(0)";
    });
    const close = () => {
        item.style.opacity = "0";
        item.style.transform = "translateY(8px)";
        window.setTimeout(() => item.remove(), 220);
    };
    window.setTimeout(close, 2200);
    item.addEventListener("click", close, { once: true });
};
