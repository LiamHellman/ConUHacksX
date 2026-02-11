// Run this script to generate PNG icons from the SVG
// node generate-icons.js

import fs from 'fs';
import { createCanvas } from 'canvas';

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  const radius = size * 0.18;
  
  // Background with rounded corners — cream
  ctx.fillStyle = '#f5f0e8';
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
  
  // Border
  ctx.strokeStyle = '#c8c0b4';
  ctx.lineWidth = size * 0.03;
  ctx.stroke();
  
  // "F" letter in accent red
  ctx.fillStyle = '#c44030';
  ctx.font = `bold ${size * 0.625}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', size / 2, size / 2 + size * 0.04);
  
  return canvas.toBuffer('image/png');
}

// Generate icons
[16, 48, 128].forEach(size => {
  const buffer = generateIcon(size);
  fs.writeFileSync(`icons/icon${size}.png`, buffer);
  console.log(`Generated icon${size}.png`);
});

console.log('Done!');
