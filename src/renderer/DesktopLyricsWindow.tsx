import { useCallback, useEffect, useState } from "react";
import type { DesktopLyricsPayload } from "../shared/types";
import { DesktopLyrics } from "./components/DesktopLyrics";

const INITIAL_PAYLOAD: DesktopLyricsPayload = {
  trackTitle: null,
  artist: null,
  currentLine: "暂无播放",
  nextLine: null,
  isLoading: false,
  fontFamily: "",
  fontSize: 28
};

export function DesktopLyricsWindow() {
  const [payload, setPayload] = useState<DesktopLyricsPayload>(INITIAL_PAYLOAD);
  const resizeWindow = useCallback((width: number, height: number) => {
    void window.musicApi.resizeDesktopLyrics(width, height);
  }, []);

  useEffect(() => {
    return window.musicApi.onDesktopLyricsUpdate(setPayload);
  }, []);

  return <DesktopLyrics payload={payload} onContentBoundsChange={resizeWindow} />;
}
