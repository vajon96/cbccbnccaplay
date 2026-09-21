import * as htmlToImage from "html-to-image";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Utility for converting OKLCH colors to standard RGB(A) format.
 * This is crucial for html2canvas and canvas operations as html2canvas does not support CSS oklch() colors
 * and crashes with: 'Attempting to parse an unsupported color function "oklch"'.
 */

// Convert single oklch values to rgb
export function oklchToRgb(l: number, c: number, h: number, a: number = 1): string {
  // Normalize hue to 0-360 range
  let normalizedH = ((h % 360) + 360) % 360;
  const hRad = (normalizedH * Math.PI) / 180;
  
  // Oklch to Oklab
  const L = l;
  const a_ = c * Math.cos(hRad);
  const b_ = c * Math.sin(hRad);
  
  // Oklab to LMS
  const l_ = L + 0.3963377774 * a_ + 0.2158037573 * b_;
  const m_ = L - 0.1055613458 * a_ - 0.0638541728 * b_;
  const s_ = L - 0.0894841775 * a_ - 1.2914855480 * b_;
  
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  
  // LMS to sRGB linear
  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  
  // Gamma correction (linear sRGB to sRGB)
  const f = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055);
  
  const R = Math.max(0, Math.min(255, Math.round(f(r) * 255)));
  const G = Math.max(0, Math.min(255, Math.round(f(g) * 255)));
  const B = Math.max(0, Math.min(255, Math.round(f(b) * 255)));
  
  const alpha = Math.max(0, Math.min(1, a));
  return alpha >= 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${alpha.toFixed(3)})`;
}

// Replace all oklch() color functions inside a string with rgb(a) equivalents
export function replaceOklchColors(str: string): string {
  if (typeof str !== 'string' || !str.includes('oklch')) return str;

  // Primary regex supporting %, none, negative hue, angle units (deg, rad, turn), alpha
  const oklchRegex = /oklch\(\s*([\d\.]+%?)\s+([\d\.]+|none)\s+([-\d\.]+(?:deg|rad|turn)?|none)(?:\s*\/\s*([\d\.]+%?))?\s*\)/gi;

  let replaced = str.replace(oklchRegex, (_fullMatch, lStr, cStr, hStr, aStr) => {
    try {
      const l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
      const c = cStr === 'none' ? 0 : parseFloat(cStr);
      let h = 0;
      if (hStr !== 'none') {
        if (hStr.endsWith('deg')) h = parseFloat(hStr);
        else if (hStr.endsWith('rad')) h = (parseFloat(hStr) * 180) / Math.PI;
        else if (hStr.endsWith('turn')) h = parseFloat(hStr) * 360;
        else h = parseFloat(hStr);
      }
      let a = 1;
      if (aStr) {
        a = aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);
      }
      return oklchToRgb(l, c, h, a);
    } catch {
      return 'rgb(15, 23, 42)';
    }
  });

  // Secondary safety net for any atypical oklch syntax
  if (replaced.includes('oklch')) {
    replaced = replaced.replace(/oklch\([^)]+\)/gi, 'rgb(30, 41, 59)');
  }

  return replaced;
}

/**
 * html2canvas onclone callback handler.
 * Sanitizes stylesheets and element computed properties, converting any OKLCH colors
 * to standard RGB colors via inline styles. This completely prevents html2canvas oklch crashes.
 */
export function handleHtml2CanvasClone(clonedDoc: Document) {
  const clonedWin = clonedDoc.defaultView || window;

  // 1. Sanitize all cloned <style> tags
  try {
    const styleTags = clonedDoc.querySelectorAll('style');
    styleTags.forEach(st => {
      if (st.textContent && st.textContent.includes('oklch')) {
        st.textContent = replaceOklchColors(st.textContent);
      }
    });
  } catch (err) {
    console.warn("Style tag sanitization warning:", err);
  }

  // 2. Sanitize element inline and computed styles
  const elements = clonedDoc.getElementsByTagName('*');
  const properties = [
    'color',
    'backgroundColor',
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'fill',
    'stroke',
    'backgroundImage',
    'boxShadow',
    'textShadow',
    'accentColor',
    'caretColor'
  ];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement;
    if (!el.style) continue;

    // Check inline style attribute
    const inlineStyle = el.getAttribute('style');
    if (inlineStyle && inlineStyle.includes('oklch')) {
      el.setAttribute('style', replaceOklchColors(inlineStyle));
    }

    try {
      const computed = clonedWin.getComputedStyle(el);
      properties.forEach(prop => {
        const val = computed[prop as any];
        if (val && typeof val === 'string' && val.includes('oklch')) {
          el.style[prop as any] = replaceOklchColors(val);
        }
      });
    } catch {
      // Fail silently for elements that cannot be inspected
    }
  }
}

export interface PdfExportOptions {
  fileName?: string;
  pixelRatio?: number;
  orientation?: "p" | "portrait" | "l" | "landscape";
  backgroundColor?: string;
}

/**
 * Robust, high-fidelity PDF downloader.
 * Uses html-to-image (SVG foreignObject native browser rendering) which natively supports
 * all modern CSS features (including OKLCH color spaces) with an automated html2canvas fallback.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  fileName: string = "document.pdf",
  options?: PdfExportOptions
): Promise<void> {
  if (!element) throw new Error("Target element is required for PDF export.");

  // 1. Ensure fonts are fully rendered
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  // 2. Ensure all nested images have loaded
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = () => resolve(null);
        img.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 3000);
      });
    })
  );

  // Short pause for paint stabilization
  await new Promise(r => setTimeout(r, 200));

  let imgData: string;

  try {
    // Primary: html-to-image (natively parses modern CSS & OKLCH without parser crashes)
    imgData = await htmlToImage.toPng(element, {
      pixelRatio: options?.pixelRatio || 2,
      backgroundColor: options?.backgroundColor || "#ffffff",
      cacheBust: true,
      style: {
        transform: "none",
        boxShadow: "none"
      }
    });
  } catch (primaryErr) {
    console.warn("htmlToImage render failed, falling back to sanitized html2canvas:", primaryErr);
    // Fallback: html2canvas with bulletproof OKLCH color sanitization
    const canvas = await html2canvas(element, {
      scale: options?.pixelRatio || 2,
      useCORS: true,
      backgroundColor: options?.backgroundColor || "#ffffff",
      logging: false,
      onclone: handleHtml2CanvasClone
    });
    imgData = canvas.toDataURL("image/png");
  }

  const orientation = options?.orientation || "p";
  const pdf = new jsPDF(orientation, "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

/**
 * Convert base64 data URI to a safe Blob URL.
 * Works inside browser iframe previews and bypasses download restrictions.
 */
export function getSafePdfUrl(pdfData: string): string {
  if (!pdfData || typeof pdfData !== "string") return "";
  if (pdfData.startsWith("data:application/pdf;base64,")) {
    try {
      const base64Part = pdfData.split(",")[1];
      const binaryString = atob(base64Part);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Error creating Blob URL from PDF base64:", e);
      return pdfData;
    }
  }
  return pdfData;
}
