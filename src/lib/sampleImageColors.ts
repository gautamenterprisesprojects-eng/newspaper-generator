/**
 * Reads the actual pixel colour at given fractional (0-1) points of an
 * image, so the header overlay's mask bands can match whatever background
 * colour a publisher's own artwork actually has there, rather than assuming
 * the Cliff News reference white/red everywhere.
 *
 * Resolves to null — never throws — for anything that can't be sampled (a
 * broken image, a cross-origin host without CORS headers tainting the
 * canvas): the caller falls back to the built-in default colours rather
 * than the header breaking.
 */
export const sampleImageColorsAt = (
  source: string,
  points: { x: number; y: number }[],
): Promise<string[] | null> =>
  new Promise((resolve) => {
    if (!source || points.length === 0) {
      resolve(null);
      return;
    }

    const image = new window.Image();

    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");

        if (!context || canvas.width === 0 || canvas.height === 0) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0);

        const colors = points.map((point) => {
          const x = Math.min(canvas.width - 1, Math.max(0, Math.round(canvas.width * point.x)));
          const y = Math.min(canvas.height - 1, Math.max(0, Math.round(canvas.height * point.y)));
          const [r, g, b] = context.getImageData(x, y, 1, 1).data;

          return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
        });

        resolve(colors);
      } catch {
        // getImageData throws on a canvas tainted by a cross-origin image
        // served without CORS headers.
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
