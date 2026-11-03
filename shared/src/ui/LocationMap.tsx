import { useEffect, useRef, useState } from "react";
import { apiBlob } from "../api/browserClient";
import { useUiTranslation } from "../i18n/useUiTranslation";
import { ModalFrame } from "./ModalFrame";

type Props = {
  name: string;
  endpoint: string;
  updatedAt?: number | null;
  onUpload?: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
};

/** Shared attachment controls and a scrollable zoom viewer; writes belong to the host app. */
export function LocationMap({
  name,
  endpoint,
  updatedAt,
  onUpload,
  onRemove,
}: Props) {
  const t = useUiTranslation("sharedUi");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const picker = useRef<HTMLInputElement>(null);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !updatedAt) return;
    let active = true;
    let url = "";
    setImageUrl("");
    setError("");
    setZoom(1);
    void apiBlob(endpoint)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImageUrl(url);
      })
      .catch(() => {
        if (active) setError(t("Could not load map."));
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, endpoint, updatedAt, retry, t]);

  async function mutate(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setRemoving(false);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : t("Could not save map."),
      );
    } finally {
      setBusy(false);
    }
  }

  const buttonStyle = {
    font: "inherit",
    color: "inherit",
    background: "rgba(127,127,127,.12)",
    border: "1px solid rgba(127,127,127,.4)",
    borderRadius: 8,
    minHeight: 44,
    padding: "8px 12px",
    cursor: "pointer",
  };
  return (
    <section style={{ display: "grid", gap: 10 }} aria-label={t("Map")}>
      <strong>{t("Map")}</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {updatedAt && (
          <button
            type="button"
            style={buttonStyle}
            onClick={() => setOpen(true)}
          >
            {t("Open map")}
          </button>
        )}
        {onUpload && (
          <>
            <button
              type="button"
              style={buttonStyle}
              disabled={busy}
              onClick={() => picker.current?.click()}
            >
              {t(busy ? "Saving…" : updatedAt ? "Replace map" : "Upload map")}
            </button>
            <input
              ref={picker}
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void mutate(() => onUpload(file));
              }}
            />
          </>
        )}
        {updatedAt && onRemove && (
          <button
            type="button"
            style={buttonStyle}
            disabled={busy}
            onClick={() => setRemoving(true)}
          >
            {t("Remove map")}
          </button>
        )}
      </div>
      {onUpload && (
        <small>
          {t(
            "PNG, JPEG, WebP or GIF. Up to 12 MB; maps retain up to 8192 pixels per side.",
          )}
        </small>
      )}
      {removing && onRemove && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{t("Remove this map?")}</span>
          <button
            type="button"
            style={buttonStyle}
            disabled={busy}
            onClick={() => void mutate(onRemove)}
          >
            {t("Remove")}
          </button>
          <button
            type="button"
            style={buttonStyle}
            disabled={busy}
            onClick={() => setRemoving(false)}
          >
            {t("Cancel")}
          </button>
        </div>
      )}
      {!open && error && <p role="alert">{error}</p>}
      <ModalFrame
        isOpen={open}
        title={`${t("Map")}: ${name}`}
        width={1400}
        onClose={() => setOpen(false)}
      >
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              style={buttonStyle}
              aria-label={t("Zoom out")}
              disabled={!imageUrl || zoom <= 1}
              onClick={() => setZoom((value) => Math.max(1, value / 1.5))}
            >
              −
            </button>
            <output aria-label={t("Zoom")}>{Math.round(zoom * 100)}%</output>
            <button
              type="button"
              style={buttonStyle}
              aria-label={t("Zoom in")}
              disabled={!imageUrl || zoom >= 16}
              onClick={() => setZoom((value) => Math.min(16, value * 1.5))}
            >
              +
            </button>
            <button
              type="button"
              style={buttonStyle}
              disabled={!imageUrl}
              onClick={() => {
                setZoom(1);
                viewport.current?.scrollTo?.(0, 0);
              }}
            >
              {t("Reset zoom")}
            </button>
            <small>
              {t(
                "Zoom in, then scroll or drag with a finger to explore the map.",
              )}
            </small>
          </div>
          {error ? (
            <div role="alert">
              {error}{" "}
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setRetry((value) => value + 1)}
              >
                {t("Retry")}
              </button>
            </div>
          ) : !imageUrl ? (
            <p role="status">{t("Loading map…")}</p>
          ) : (
            <div
              ref={viewport}
              tabIndex={0}
              aria-label={t("Map viewer")}
              style={{
                height: "min(65dvh, 800px)",
                overflow: "auto",
                overscrollBehavior: "contain",
                touchAction: "pan-x pan-y pinch-zoom",
                border: "1px solid rgba(127,127,127,.4)",
              }}
            >
              <img
                src={imageUrl}
                alt={name}
                draggable={false}
                onError={() => setError(t("Could not load map."))}
                style={{
                  display: "block",
                  width: `${zoom * 100}%`,
                  maxWidth: "none",
                  height: "auto",
                }}
              />
            </div>
          )}
        </div>
      </ModalFrame>
    </section>
  );
}
