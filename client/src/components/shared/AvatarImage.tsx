import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import type { ImgHTMLAttributes, SyntheticEvent } from "react";

interface AvatarImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  name: string;
  fallbackSize?: number;
}

const AVATAR_COLORS = [
  { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#DBEAFE", fg: "#1E3A8A" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#EDE9FE", fg: "#5B21B6" },
  { bg: "#FEE2E2", fg: "#991B1B" }
];

const hashString = (value: string) => {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
};

const getInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  const chars = Array.from(trimmed);
  return chars.slice(0, 2).join("").toUpperCase();
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildFallbackAvatar = (name: string, size: number) => {
  const hash = hashString(name || "user");
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const initials = getInitials(name || "U");
  const safeInitials = escapeXml(initials);
  const fontSize = Math.floor(size * 0.38);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${safeInitials}"><rect width="100%" height="100%" rx="${Math.floor(size / 2)}" fill="${color.bg}" /><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${color.fg}">${safeInitials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const AvatarImage = ({
  src,
  name,
  alt,
  className,
  fallbackSize = 96,
  onError,
  ...rest
}: AvatarImageProps) => {
  const fallbackSrc = useMemo(() => buildFallbackAvatar(name, fallbackSize), [fallbackSize, name]);
  const preferredSrc = src?.trim() ? src : fallbackSrc;
  const [resolvedSrc, setResolvedSrc] = useState(preferredSrc);

  useEffect(() => {
    setResolvedSrc(preferredSrc);
  }, [preferredSrc]);

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    if (resolvedSrc !== fallbackSrc) {
      setResolvedSrc(fallbackSrc);
    }
    onError?.(event);
  };

  return (
    <img
      {...rest}
      src={resolvedSrc}
      alt={alt ?? `${name} 頭像`}
      onError={handleError}
      className={clsx("object-cover", className)}
    />
  );
};
