// Run this script to generate PNG icons from the SVG
// node generate-icons.js

import fs from 'fs';
import { createCanvas } from 'canvas';

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  const radius = size * 0.18;
  
  // Background with rounded corners
  ctx.fillStyle = '#0a0a0f';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();
  
  // Gradient for lightning bolt
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#8b5cf6');
  gradient.addColorStop(0.5, '#3b82f6');
  gradient.addColorStop(1, '#ec4899');
  
  // Lightning bolt path
  ctx.fillStyle = gradient;
  const s = size / 128;
  ctx.beginPath();
  ctx.moveTo(72 * s, 20 * s);
  ctx.lineTo(52 * s, 60 * s);
  ctx.lineTo(72 * s, 60 * s);
  ctx.lineTo(56 * s, 108 * s);
  ctx.lineTo(76 * s, 68 * s);
  ctx.lineTo(56 * s, 68 * s);
  ctx.closePath();
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

// Generate icons
[16, 48, 128].forEach(size => {
  const buffer = generateIcon(size);
  fs.writeFileSync(`icons/icon${size}.png`, buffer);
  console.log(`Generated icon${size}.png`);
});

console.log('Done!');
