// Generate PWA icons as simple SVG-based PNGs
import { writeFileSync } from "fs";

function createSvgIcon(size) {
  const pad = Math.round(size * 0.15);
  const fontSize = Math.round(size * 0.35);
  const subSize = Math.round(size * 0.1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="#0a0a0a"/>
  <rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" rx="${Math.round(size * 0.08)}" fill="none" stroke="#D4A843" stroke-width="${Math.round(size * 0.02)}"/>
  <text x="${size / 2}" y="${size / 2 - subSize * 0.3}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-weight="900" font-size="${fontSize}" fill="#D4A843" font-style="italic">GF</text>
  <text x="${size / 2}" y="${size / 2 + fontSize * 0.6}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="600" font-size="${subSize}" fill="#D4A84380" letter-spacing="${Math.round(size * 0.02)}">PRACTICE</text>
</svg>`;
}

// Write SVG files (browsers can use these, and they look great at any size)
writeFileSync("public/icons/icon-192.svg", createSvgIcon(192));
writeFileSync("public/icons/icon-512.svg", createSvgIcon(512));

// For PWA manifest we need actual PNGs, but SVGs work as favicons
// We'll use the SVGs and note that for production, convert to PNG
console.log("SVG icons created. For production PWA, convert to PNG using:");
console.log("  npx sharp-cli -i public/icons/icon-192.svg -o public/icons/icon-192.png");
console.log("  npx sharp-cli -i public/icons/icon-512.svg -o public/icons/icon-512.png");
