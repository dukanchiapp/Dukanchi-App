const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Orange rounded-rect background
  const radius = size * 0.22;
  ctx.fillStyle = '#FF6B35';
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

  // White "द" text centered
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.floor(size * 0.55)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('द', size / 2, size / 2 + size * 0.04);

  const buffer = canvas.toBuffer('image/png');
  const dir = path.join(__dirname, '../public/icons');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `icon-${size}x${size}.png`), buffer);
  console.log(`Generated icon-${size}x${size}.png`);
}

sizes.forEach(size => generateIcon(size));
console.log('All icons generated in public/icons/');
