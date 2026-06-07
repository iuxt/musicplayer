import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  onChooseFolder: () => void;
  isScanning: boolean;
}

export function EmptyState({ onChooseFolder, isScanning }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-icon">
        <FolderOpen size={34} />
      </div>
      <h2>Choose your music folder</h2>
      <p>Scan a local folder and every nested folder inside it. Your songs stay on this computer.</p>
      <button className="primary-button" onClick={onChooseFolder} disabled={isScanning} type="button">
        Choose Folder
      </button>
    </section>
  );
}
