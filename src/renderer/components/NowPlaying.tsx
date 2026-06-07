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
          <img className="cover-image" src={artworkUrl} alt={track ? `${track.album} cover` : "Album cover"} />
        ) : (
          <div className="cover-art">
            <Disc3 size={84} />
          </div>
        )}
      </div>
      <div className="track-copy">
        <p className="eyebrow">Now Playing</p>
        <h1>{track?.title ?? "Nothing playing"}</h1>
        <p>{track ? `${track.artist} - ${track.album}` : "Choose a folder and pick a track."}</p>
        {playbackError ? <span className="error-pill">{playbackError}</span> : null}
      </div>
    </section>
  );
}
