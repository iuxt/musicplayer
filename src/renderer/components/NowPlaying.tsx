import { Disc3 } from "lucide-react";
import type { Track } from "../../shared/types";

interface NowPlayingProps {
  track: Track | null;
  artworkUrl: string | null;
  playbackError: string | null;
}

export function NowPlaying({ track, artworkUrl, playbackError }: NowPlayingProps) {
  return (
    <section className="now-playing">
      <div className="cover-frame">
        {artworkUrl ? (
          <img className="cover-image" src={artworkUrl} alt={track ? `${track.album} 封面` : "专辑封面"} />
        ) : (
          <div className="cover-art">
            <Disc3 size={84} />
          </div>
        )}
      </div>
      <div className="track-copy">
        <p className="eyebrow">正在播放</p>
        <h1>{track?.title ?? "暂无播放"}</h1>
        <p>{track ? `${track.artist} - ${track.album}` : "选择文件夹并播放歌曲。"}</p>
        {playbackError ? <span className="error-pill">{playbackError}</span> : null}
      </div>
    </section>
  );
}
