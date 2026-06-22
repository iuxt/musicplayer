import type { Track } from "../../shared/types";
import { ArtworkImage } from "./ArtworkImage";

interface NowPlayingProps {
  track: Track | null;
  artworkUrl: string | null;
  playbackError: string | null;
}

export function NowPlaying({ track, artworkUrl, playbackError }: NowPlayingProps) {
  return (
    <section className="now-playing">
      <div className="cover-frame">
        <ArtworkImage
          artworkUrl={artworkUrl}
          alt={track ? `${track.album} 封面` : "专辑封面"}
          imageClassName="cover-image"
          fallbackClassName="cover-art"
          iconSize={84}
        />
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
