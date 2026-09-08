import { useState, useEffect } from 'react';

export function getFallbackColor(coverUrl?: string, title?: string, artist?: string): string {
  const str = (title || '') + (artist || '') + (coverUrl || '');
  if (!str) return '#ef4444';

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 88%, 56%)`;
}

// Custom hook that extracts real vibrant color from image canvas, or returns deterministic harmonic HSL color
export function useCoverColor(coverUrl?: string, title?: string, artist?: string): string {
  const [color, setColor] = useState<string>(() => getFallbackColor(coverUrl, title, artist));

  useEffect(() => {
    if (!coverUrl) {
      setColor(getFallbackColor(coverUrl, title, artist));
      return;
    }

    let active = true;
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 12;
        canvas.height = 12;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, 12, 12);
        const imageData = ctx.getImageData(0, 0, 12, 12).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < imageData.length; i += 4) {
          const alpha = imageData[i + 3];
          if (alpha > 128) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }

        if (count > 0 && active) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          
          // Subtle, gentle tint boost ONLY for colors that are washed-out whitish or grayish
          let rN = r / 255, gN = g / 255, bN = b / 255;
          let maxVal = Math.max(rN, gN, bN), minVal = Math.min(rN, gN, bN);
          let hVal = 0, sVal = 0, lVal = (maxVal + minVal) / 2;

          if (maxVal !== minVal) {
            let dVal = maxVal - minVal;
            sVal = lVal > 0.5 ? dVal / (2 - maxVal - minVal) : dVal / (maxVal + minVal);
            switch (maxVal) {
              case rN: hVal = (gN - bN) / dVal + (gN < bN ? 6 : 0); break;
              case gN: hVal = (bN - rN) / dVal + 2; break;
              case bN: hVal = (rN - gN) / dVal + 4; break;
            }
            hVal /= 6;
          }

          // ONLY target truly whitish (high lightness + low saturation) or grayish (very low saturation)
          const isWhitishOrGrayish = (sVal < 0.12 && lVal > 0.60) || (sVal < 0.08);

          if (isWhitishOrGrayish) {
            // Apply a subtle, natural boost (max saturation ~0.35, not fluo/neon)
            sVal = Math.min(0.38, Math.max(0.28, sVal + 0.25));
            if (lVal > 0.78) lVal = 0.68; // Slightly soften blinding white

            const hue2rgb = (p: number, q: number, t: number) => {
              if (t < 0) t += 1;
              if (t > 1) t -= 1;
              if (t < 1/6) return p + (q - p) * 6 * t;
              if (t < 1/2) return q;
              if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
              return p;
            };

            const qVal = lVal < 0.5 ? lVal * (1 + sVal) : lVal + sVal - lVal * sVal;
            const pVal = 2 * lVal - qVal;
            r = Math.round(hue2rgb(pVal, qVal, hVal + 1/3) * 255);
            g = Math.round(hue2rgb(pVal, qVal, hVal) * 255);
            b = Math.round(hue2rgb(pVal, qVal, hVal - 1/3) * 255);
          }

          setColor(`rgb(${r}, ${g}, ${b})`);
        }
      } catch {
        if (active) {
          setColor(getFallbackColor(coverUrl, title, artist));
        }
      }
    };

    img.onerror = () => {
      if (active) {
        setColor(getFallbackColor(coverUrl, title, artist));
      }
    };

    img.src = coverUrl;

    return () => {
      active = false;
    };
  }, [coverUrl, title, artist]);

  return color;
}
