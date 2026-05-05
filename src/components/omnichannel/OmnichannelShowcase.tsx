import type { PublicShowcaseImage } from './types';

interface Props {
  images: PublicShowcaseImage[];
  alt?: string;
}

/**
 * Tampilkan showcase image di halaman publik dengan ratio asli (tanpa crop).
 * Multiple image akan di-stack vertikal — tiap gambar tetap natural ratio-nya.
 */
export function OmnichannelShowcase({ images, alt }: Props) {
  if (images.length === 0) return null;

  return (
    <div className="space-y-4">
      {images.map((img, i) => (
        <div
          key={`${img.url}-${i}`}
          className="rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={alt ? `${alt} — showcase ${i + 1}` : `Showcase ${i + 1}`}
            className="w-full h-auto block"
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        </div>
      ))}
    </div>
  );
}
