import type { ScanProgress } from "../../shared/types";

interface ScanningStateProps {
  progress: ScanProgress | null;
}

export function ScanningState({ progress }: ScanningStateProps) {
  return (
    <div className="scan-strip">
      <div className="pulse-dot" />
      <div>
        <strong>Scanning library</strong>
        <span>{progress ? `${progress.discoveredTracks} tracks found` : "Preparing folder scan"}</span>
      </div>
    </div>
  );
}
