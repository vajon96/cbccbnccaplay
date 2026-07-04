/**
 * Utility for converting OKLCH colors to standard RGB(A) format.
 * This is crucial for html2canvas as it does not support CSS oklch() colors
 * and will crash when parsing elements or stylesheets with OKLCH.
 */

// Convert single oklch values to rgb
export function oklchToRgb(l: number, c: number, h: number, a: number = 1): string {
  // Convert h to radians
  const hRad = (h * Math.PI) / 180;
  
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
  const f = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  
  const R = Math.max(0, Math.min(255, Math.round(f(r) * 255)));
  const G = Math.max(0, Math.min(255, Math.round(f(g) * 255)));
  const B = Math.max(0, Math.min(255, Math.round(f(b) * 255)));
  
  return a === 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${a})`;
}

// Replace all oklch() color functions inside a string with rgb(a) equivalents
export function replaceOklchColors(str: string): string {
  if (typeof str !== 'string') return str;
  return str.replace(/oklch\(\s*([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)(?:\s*\/\s*([\d\.]+%?))?\s*\)/gi, (fullMatch, lStr, cStr, hStr, aStr) => {
    try {
      const l = parseFloat(lStr);
      const c = parseFloat(cStr);
      const h = parseFloat(hStr);
      let a = 1;
      if (aStr) {
        if (aStr.endsWith('%')) {
          a = parseFloat(aStr) / 100;
        } else {
          a = parseFloat(aStr);
        }
      }
      return oklchToRgb(l, c, h, a);
    } catch (e) {
      return fullMatch;
    }
  });
}

/**
 * html2canvas onclone callback handler.
 * Deeply traverses the cloned document, converting any element properties using oklch colors
 * to standard RGB colors via inline styles. This bypasses html2canvas oklch crashes completely.
 */
export function handleHtml2CanvasClone(clonedDoc: Document) {
  const clonedWin = clonedDoc.defaultView || window;
  const elements = clonedDoc.getElementsByTagName('*');
  
  const properties = [
    'color',
    'backgroundColor',
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'fill',
    'stroke',
    'backgroundImage',
    'boxShadow',
    'textShadow'
  ];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement;
    if (!el.style) continue;
    
    try {
      const style = clonedWin.getComputedStyle(el);
      properties.forEach(prop => {
        const val = style[prop as any];
        if (val && typeof val === 'string' && val.includes('oklch')) {
          el.style[prop as any] = replaceOklchColors(val);
        }
      });
    } catch (err) {
      // Fail silently for elements that cannot be parsed
    }
  }
}
