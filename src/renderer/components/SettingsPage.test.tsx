import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("renders library actions and disables rescan without a folder", () => {
    const props = makeProps({ folderPath: null });

    render(<SettingsPage {...props} />);

    expect(screen.getByRole("region", { name: "设置" })).toBeTruthy();
    expect(screen.getByText("尚未选择音乐文件夹。")).toBeTruthy();
    expect((screen.getByRole("button", { name: "重新扫描音乐库" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables rescan while scanning an existing folder", () => {
    const props = makeProps({ folderPath: "/Users/test/Music", isScanning: true });

    render(<SettingsPage {...props} />);

    expect((screen.getByRole("button", { name: "重新扫描音乐库" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls library action callbacks", () => {
    const props = makeProps({ folderPath: "/Users/test/Music" });

    render(<SettingsPage {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "选择文件夹" }));
    fireEvent.click(screen.getByRole("button", { name: "重新扫描音乐库" }));
    fireEvent.click(screen.getByRole("button", { name: "清除音乐库缓存" }));

    expect(props.onChooseFolder).toHaveBeenCalled();
    expect(props.onRescanLibrary).toHaveBeenCalled();
    expect(props.onClearLibraryCache).toHaveBeenCalled();
  });

  it("shows cache status and cache error messages", () => {
    render(
      <SettingsPage
        {...makeProps({
          cacheStatus: "音乐库缓存已清除。",
          cacheError: "无法清除音乐库缓存。"
        })}
      />
    );

    expect(screen.getByRole("status").textContent).toBe("音乐库缓存已清除。");
    expect(screen.getByRole("alert").textContent).toBe("无法清除音乐库缓存。");
  });

  it("shows the app version in the about section", () => {
    render(<SettingsPage {...makeProps({ appVersion: "v1.6.0" })} />);

    expect(screen.getByRole("heading", { name: "关于" })).toBeTruthy();
    expect(screen.getByText("版本")).toBeTruthy();
    expect(screen.getByText("v1.6.0")).toBeTruthy();
  });

  it("changes fullscreen lyrics font settings", () => {
    const props = makeProps({ fullscreenLyricsFontFamily: "", fullscreenLyricsFontSize: 36 });

    render(<SettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText("全屏歌词字体"), { target: { value: "PingFang SC" } });
    fireEvent.change(screen.getByLabelText("全屏歌词字号"), { target: { value: "48" } });

    expect(props.onFullscreenLyricsFontFamilyChange).toHaveBeenCalledWith("PingFang SC");
    expect(props.onFullscreenLyricsFontSizeChange).toHaveBeenCalledWith(48);
  });

  it("renders lyric font size controls as dropdowns", () => {
    render(<SettingsPage {...makeProps()} />);

    expect(screen.getByLabelText("全屏歌词字号").tagName).toBe("SELECT");
    expect(screen.getByLabelText("桌面歌词字号").tagName).toBe("SELECT");
    expect(screen.queryByRole("slider", { name: "全屏歌词字号" })).toBeNull();
    expect(screen.queryByRole("slider", { name: "桌面歌词字号" })).toBeNull();
  });

  it("changes desktop lyrics settings", () => {
    const props = makeProps({ desktopLyricsEnabled: false, desktopLyricsFontFamily: "", desktopLyricsFontSize: 28 });

    render(<SettingsPage {...props} />);
    fireEvent.click(screen.getByLabelText("显示桌面歌词"));
    fireEvent.change(screen.getByLabelText("桌面歌词字体"), { target: { value: "LXGW WenKai" } });
    fireEvent.change(screen.getByLabelText("桌面歌词字号"), { target: { value: "32" } });

    expect(props.onDesktopLyricsEnabledChange).toHaveBeenCalledWith(true);
    expect(props.onDesktopLyricsFontFamilyChange).toHaveBeenCalledWith("LXGW WenKai");
    expect(props.onDesktopLyricsFontSizeChange).toHaveBeenCalledWith(32);
  });

  it("changes playback system media shortcut settings", () => {
    const props = makeProps({ systemMediaShortcutsEnabled: false });

    render(<SettingsPage {...props} />);
    fireEvent.click(screen.getByLabelText("系统媒体快捷键"));

    expect(props.onSystemMediaShortcutsEnabledChange).toHaveBeenCalledWith(true);
  });

  it("changes the close-window playback setting", () => {
    const props = makeProps({ closeWindowStopsPlayback: false });

    render(<SettingsPage {...props} />);
    fireEvent.click(screen.getByLabelText("关闭窗口时停止播放"));

    expect(props.onCloseWindowStopsPlaybackChange).toHaveBeenCalledWith(true);
  });
});

function makeProps(overrides: Partial<Parameters<typeof SettingsPage>[0]> = {}): Parameters<typeof SettingsPage>[0] {
  return {
    folderPath: "/Users/test/Music",
    isScanning: false,
    availableFontFamilies: ["", "PingFang SC", "LXGW WenKai"],
    fullscreenLyricsFontFamily: "",
    fullscreenLyricsFontSize: 36,
    systemMediaShortcutsEnabled: false,
    closeWindowStopsPlayback: false,
    desktopLyricsEnabled: false,
    desktopLyricsFontFamily: "",
    desktopLyricsFontSize: 28,
    appVersion: "unknown",
    cacheStatus: null,
    cacheError: null,
    onChooseFolder: vi.fn(),
    onRescanLibrary: vi.fn(),
    onClearLibraryCache: vi.fn(),
    onFullscreenLyricsFontFamilyChange: vi.fn(),
    onFullscreenLyricsFontSizeChange: vi.fn(),
    onSystemMediaShortcutsEnabledChange: vi.fn(),
    onCloseWindowStopsPlaybackChange: vi.fn(),
    onDesktopLyricsEnabledChange: vi.fn(),
    onDesktopLyricsFontFamilyChange: vi.fn(),
    onDesktopLyricsFontSizeChange: vi.fn(),
    ...overrides
  };
}
