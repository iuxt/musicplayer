import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type { DesktopLyricsPayload } from "../../shared/types";

interface DesktopLyricsProps {
  payload: DesktopLyricsPayload;
  onContentBoundsChange?: (width: number, height: number) => void;
}

export function DesktopLyrics({ payload, onContentBoundsChange }: DesktopLyricsProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const style = {
    "--desktop-lyrics-font-family": payload.fontFamily
      ? `"${payload.fontFamily}", ui-sans-serif, system-ui, sans-serif`
      : "ui-sans-serif, system-ui, sans-serif",
    "--desktop-lyrics-font-size": `${payload.fontSize}px`
  } as CSSProperties & Record<"--desktop-lyrics-font-family" | "--desktop-lyrics-font-size", string>;

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !onContentBoundsChange || typeof ResizeObserver === "undefined") {
      return;
    }

    let previousWidth = 0;
    let previousHeight = 0;
    const notifySize = () => {
      const bounds = surface.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(bounds.width));
      const height = Math.max(1, Math.ceil(bounds.height));
      if (width === previousWidth && height === previousHeight) {
        return;
      }

      previousWidth = width;
      previousHeight = height;
      onContentBoundsChange(width, height);
    };

    const observer = new ResizeObserver(notifySize);
    observer.observe(surface);
    notifySize();
    return () => observer.disconnect();
  }, [
    onContentBoundsChange,
    payload.currentLine,
    payload.fontFamily,
    payload.fontSize,
    payload.isLoading,
    payload.nextLine
  ]);

  return (
    <section ref={surfaceRef} className="desktop-lyrics-shell" aria-label="桌面歌词" style={style}>
      <div className="desktop-lyrics-text">
        <p className={payload.isLoading ? "desktop-lyrics-current loading" : "desktop-lyrics-current"}>
          {payload.currentLine ?? "暂无播放"}
        </p>
        {payload.nextLine ? <p className="desktop-lyrics-next">{payload.nextLine}</p> : null}
      </div>
    </section>
  );
}
