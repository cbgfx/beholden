import { useEffect } from "react";

export function ImageLightbox(props: { src: string | null; alt: string; onClose: () => void }) {
  const { src, alt, onClose } = props;
  useEffect(() => {
    if (!src) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [src, onClose]);
  if (!src) return null;
  return <div role="dialog" aria-modal="true" aria-label={alt} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4000, padding: "clamp(18px,4vw,56px)", display: "grid", placeItems: "center", background: "rgba(0,0,0,.86)", backdropFilter: "blur(5px)", cursor: "zoom-out" }}>
    <button type="button" aria-label="Close image" title="Close" onClick={onClose} style={{ position: "fixed", top: 18, right: 20, width: 42, height: 42, border: "1px solid rgba(255,255,255,.25)", borderRadius: 10, background: "rgba(10,15,25,.85)", color: "#fff", font: "inherit", fontSize: 26, lineHeight: 1, cursor: "pointer" }}>×</button>
    <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} style={{ display: "block", maxWidth: "min(92vw,1200px)", maxHeight: "88vh", width: "auto", height: "auto", objectFit: "contain", borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,.65)", cursor: "default" }}/>
  </div>;
}
