import React from "react";

/** Keep an unsaved profile preview local to the profile's lifetime. */
export function useTextScalePreview(savedScale = 1) {
  const [textScale, setTextScale] = React.useState(savedScale);
  const savedScaleRef = React.useRef(savedScale);

  React.useEffect(() => {
    savedScaleRef.current = savedScale;
  }, [savedScale]);

  React.useEffect(() => () => {
    document.documentElement.style.setProperty("--text-scale", String(savedScaleRef.current));
  }, []);

  const previewTextScale = React.useCallback((value: number) => {
    setTextScale(value);
    document.documentElement.style.setProperty("--text-scale", String(value));
  }, []);

  return { textScale, previewTextScale };
}
