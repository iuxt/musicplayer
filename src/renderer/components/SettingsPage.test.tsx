import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("renders library actions and disables rescan without a folder", () => {
    const props = makeProps({ folderPath: null });

    render(<SettingsPage {...props} />);

    expect(screen.getByRole("region", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("No music folder selected.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Rescan Library" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls library action callbacks", () => {
    const props = makeProps({ folderPath: "/Users/test/Music" });

    render(<SettingsPage {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Rescan Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Library Cache" }));

    expect(props.onChooseFolder).toHaveBeenCalled();
    expect(props.onRescanLibrary).toHaveBeenCalled();
    expect(props.onClearLibraryCache).toHaveBeenCalled();
  });

  it("shows cache status and cache error messages", () => {
    render(
      <SettingsPage
        {...makeProps({
          cacheStatus: "Library cache cleared.",
          cacheError: "Unable to clear the library cache."
        })}
      />
    );

    expect(screen.getByText("Library cache cleared.")).toBeTruthy();
    expect(screen.getByText("Unable to clear the library cache.")).toBeTruthy();
  });

  it("changes fullscreen lyrics font size", () => {
    const props = makeProps({ fullscreenLyricsFontSize: 36 });

    render(<SettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText("Fullscreen lyrics font size"), { target: { value: "48" } });

    expect(props.onFullscreenLyricsFontSizeChange).toHaveBeenCalledWith(48);
    expect(screen.getByText("36px")).toBeTruthy();
    expect(screen.getByText("Lyrics preview line")).toBeTruthy();
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
