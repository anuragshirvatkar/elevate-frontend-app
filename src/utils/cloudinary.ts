import { PixelRatio } from 'react-native';

/**
 * Rewrites a Cloudinary delivery URL to serve an optimized, right-sized image.
 *
 * Cloudinary originals (e.g. the avatar/companion PNGs) are full-resolution and
 * can be several MB each — on a cold start with no cache this makes images take
 * a long time to appear. Inserting `f_auto,q_auto,w_<px>` lets Cloudinary serve
 * a modern format (WebP/AVIF) at the exact display size, typically shrinking the
 * payload by 85–95% with no visible quality loss.
 *
 * Safe no-op for empty values, non-Cloudinary URLs, or URLs that already carry a
 * transformation segment (so we never double-apply).
 *
 * @param url          The original image URL.
 * @param displayWidth The on-screen width in dp the image renders at.
 */
export function optimizeCloudinaryUrl(
  url?: string | null,
  displayWidth = 120,
): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;

  const [prefix, rest] = url.split('/upload/');
  if (!rest) return url;

  // If the first segment after /upload/ is already a transformation, leave it be.
  const firstSegment = rest.split('/')[0];
  if (/(^|,)(f_|q_|w_|h_|c_|e_|dpr_|g_|ar_)/.test(firstSegment)) return url;

  const targetPx = Math.round(displayWidth * Math.min(PixelRatio.get(), 3));
  return `${prefix}/upload/f_auto,q_auto,w_${targetPx}/${rest}`;
}
