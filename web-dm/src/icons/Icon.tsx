import * as React from "react";

export type SvgIconProps = {
  svg: string;
  size?: number;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
};

function injectSizeAndA11y(svg: string, size: number, title?: string) {
  // Add width/height; keep existing viewBox.
  // Also avoid double-injecting if already present.
  const hasWidth = /\swidth=/.test(svg);
  const hasHeight = /\sheight=/.test(svg);

  let out = svg;
  if (!hasWidth || !hasHeight) {
    out = out.replace(
      "<svg",
      `<svg${hasWidth ? "" : ` width="${size}"`}${hasHeight ? "" : ` height="${size}"`}`
    );
  }

  if (title) {
    // If consumer provides a title, set role/img and aria-label.
    if (!/\srole=/.test(out)) out = out.replace("<svg", `<svg role="img"`);
    if (!/\saria-label=/.test(out)) out = out.replace("<svg", `<svg aria-label="${escapeAttr(title)}"`);
  }

  return out;
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function Icon({ svg, size = 20, title, className, style }: SvgIconProps) {
  const markup = React.useMemo(() => injectSizeAndA11y(svg, size, title), [svg, size, title]);

  return (
    <span
      className={className}
      style={{ display: "inline-flex", width: size, height: size, color: "inherit", ...style }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
