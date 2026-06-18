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

  it("changes fullscreen lyrics font size", () => {
    const props = makeProps({ fullscreenLyricsFontSize: 36 });

    render(<SettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText("全屏歌词字号"), { target: { value: "48" } });

    expect(props.onFullscreenLyricsFontSizeChange).toHaveBeenCalledWith(48);
    expect(screen.getByText("36px")).toBeTruthy();
    expect(screen.getByText("歌词预览行")).toBeTruthy();
  });
});

function makeProps(overrides: Partial<Parameters<typeof SettingsPage>[0]> = {}): Parameters<typeof SettingsPage>[0] {
  return {
    folderPath: "/Users/test/Music",
    isScanning: false,
    fullscreenLyricsFontSize: 36,
    cacheStatus: null,
    cacheError: null,
    onChooseFolder: vi.fn(),
    onRescanLibrary: vi.fn(),
    onClearLibraryCache: vi.fn(),
    onFullscreenLyricsFontSizeChange: vi.fn(),
    ...overrides
  };
}
