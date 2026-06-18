import type { ScanProgress } from "../../shared/types";

interface ScanningStateProps {
  progress: ScanProgress | null;
}

export function ScanningState({ progress }: ScanningStateProps) {
  return (
    <div className="scan-strip">
      <div className="pulse-dot" />
      <div>
        <strong>正在扫描音乐库</strong>
        <span>{progress ? `已找到 ${progress.discoveredTracks} 首歌曲` : "正在准备文件夹扫描"}</span>
      </div>
    </div>
  );
}
