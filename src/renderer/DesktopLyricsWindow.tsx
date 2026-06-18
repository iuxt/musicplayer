import { useEffect, useState } from "react";
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

  useEffect(() => {
    return window.musicApi.onDesktopLyricsUpdate(setPayload);
  }, []);

  return (
    <DesktopLyrics
      payload={payload}
      onClose={() => {
        void window.musicApi.closeDesktopLyrics();
      }}
      onOpenSettings={() => {
        void window.musicApi.openMainSettingsFromDesktopLyrics();
      }}
    />
  );
}
