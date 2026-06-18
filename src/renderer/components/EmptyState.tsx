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
      <h2>选择音乐文件夹</h2>
      <p>扫描本地文件夹及其子文件夹。你的歌曲会留在这台电脑上。</p>
      <button className="primary-button" onClick={onChooseFolder} disabled={isScanning} type="button">
        选择文件夹
      </button>
    </section>
  );
}
