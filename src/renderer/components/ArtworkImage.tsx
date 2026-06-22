import { Disc3 } from "lucide-react";
import { useEffect, useState } from "react";

interface ArtworkImageProps {
  artworkUrl: string | null;
  alt: string;
  iconSize: number;
  imageClassName?: string;
  fallbackClassName?: string;
}

export function ArtworkImage({ artworkUrl, alt, iconSize, imageClassName, fallbackClassName }: ArtworkImageProps) {
  const [failedArtworkUrl, setFailedArtworkUrl] = useState<string | null>(null);
  const visibleArtworkUrl = artworkUrl && artworkUrl !== failedArtworkUrl ? artworkUrl : null;

  useEffect(() => {
    setFailedArtworkUrl(null);
  }, [artworkUrl]);

  if (visibleArtworkUrl) {
    return (
      <img
        className={imageClassName}
        src={visibleArtworkUrl}
        alt={alt}
        onError={() => setFailedArtworkUrl(visibleArtworkUrl)}
      />
    );
  }

  if (fallbackClassName) {
    return (
      <div className={fallbackClassName}>
        <Disc3 size={iconSize} />
      </div>
    );
  }

  return <Disc3 size={iconSize} aria-hidden="true" />;
}
