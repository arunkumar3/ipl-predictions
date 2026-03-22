// Run with: node scripts/generate-icons.js
// Generates placeholder PWA icons using canvas

import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0E1842';
  ctx.fillRect(0, 0, size, size);

  // "IPL" text
  ctx.fillStyle = '#C8E629';
  ctx.font = `bold ${size * 0.3}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('IPL', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

// Note: This requires the 'canvas' npm package.
// For a simpler approach, create icons manually or use an online generator.
// For now, we'll just create simple SVG-based placeholder.
console.log('To create PWA icons, use an online tool or image editor.');
console.log('Create 192x192 and 512x512 PNG files with #0E1842 background and "IPL" text in #C8E629.');
console.log('Save as public/icon-192.png and public/icon-512.png');
