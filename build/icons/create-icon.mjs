#!/usr/bin/env node

/**
 * Create HyperWallet app icon using sharp
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iconDir = __dirname;

// Create a wallet icon programmatically
async function createWalletIcon(size = 1024) {
  // Create SVG with wallet design
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="${size * 0.004}"/>
          <feOffset dx="0" dy="${size * 0.004}" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Background circle with gradient -->
      <circle cx="${size/2}" cy="${size/2}" r="${size * 0.45}" fill="url(#grad)" filter="url(#shadow)"/>
      
      <!-- Wallet body -->
      <rect x="${size * 0.25}" y="${size * 0.3125}" width="${size * 0.5}" height="${size * 0.375}" 
            rx="${size * 0.03125}" ry="${size * 0.03125}" fill="#ffffff" opacity="0.95"/>
      
      <!-- Wallet flap/cover -->
      <path d="M ${size * 0.25} ${size * 0.3125} Q ${size * 0.5} ${size * 0.234} ${size * 0.75} ${size * 0.3125} 
               L ${size * 0.75} ${size * 0.39} Q ${size * 0.5} ${size * 0.3125} ${size * 0.25} ${size * 0.39} Z" 
            fill="#ffffff" opacity="0.9"/>
      
      <!-- Wallet opening line -->
      <rect x="${size * 0.25}" y="${size * 0.39}" width="${size * 0.5}" height="${size * 0.008}" 
            fill="url(#grad)" opacity="0.3"/>
      
      <!-- Card slots -->
      <rect x="${size * 0.3125}" y="${size * 0.46875}" width="${size * 0.375}" height="${size * 0.047}" 
            rx="${size * 0.008}" ry="${size * 0.008}" fill="#e5e7eb" opacity="0.6"/>
      <rect x="${size * 0.3125}" y="${size * 0.546875}" width="${size * 0.3125}" height="${size * 0.047}" 
            rx="${size * 0.008}" ry="${size * 0.008}" fill="#e5e7eb" opacity="0.4"/>
      
      <!-- Letter H for HyperWallet -->
      <text x="${size/2}" y="${size * 0.664}" font-family="Arial, sans-serif" font-size="${size * 0.195}" 
            font-weight="bold" fill="url(#grad)" text-anchor="middle" opacity="0.8">H</text>
      
      <!-- Shine effect -->
      <ellipse cx="${size * 0.39}" cy="${size * 0.351}" rx="${size * 0.117}" ry="${size * 0.078}" 
               fill="#ffffff" opacity="0.3"/>
    </svg>
  `;

  // Convert SVG to PNG
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();

  return pngBuffer;
}

async function main() {
  console.log('Creating HyperWallet app icons...\n');

  // Create 1024x1024 main icon
  console.log('Generating 1024x1024 icon...');
  const icon1024 = await createWalletIcon(1024);
  const iconPath = join(iconDir, 'icon.png');
  await sharp(icon1024).toFile(iconPath);
  console.log(`✓ Created ${iconPath}`);

  // Generate macOS .icns file
  if (process.platform === 'darwin') {
    console.log('\nGenerating macOS icon set...');
    const iconsetDir = join(iconDir, 'icon.iconset');
    
    if (!existsSync(iconsetDir)) {
      mkdirSync(iconsetDir, { recursive: true });
    }

    const macSizes = [
      { size: 16, scale: 1, name: 'icon_16x16.png' },
      { size: 32, scale: 1, name: 'icon_32x32.png' },
      { size: 32, scale: 2, name: 'icon_32x32@2x.png' },
      { size: 64, scale: 1, name: 'icon_64x64.png' },
      { size: 128, scale: 1, name: 'icon_128x128.png' },
      { size: 128, scale: 2, name: 'icon_128x128@2x.png' },
      { size: 256, scale: 1, name: 'icon_256x256.png' },
      { size: 256, scale: 2, name: 'icon_256x256@2x.png' },
      { size: 512, scale: 1, name: 'icon_512x512.png' },
      { size: 512, scale: 2, name: 'icon_512x512@2x.png' },
      { size: 1024, scale: 1, name: 'icon_1024x1024.png' },
      { size: 1024, scale: 2, name: 'icon_1024x1024@2x.png' }
    ];

    for (const { size, scale, name } of macSizes) {
      const actualSize = size * scale;
      const icon = await createWalletIcon(actualSize);
      const outputPath = join(iconsetDir, name);
      await sharp(icon).toFile(outputPath);
      console.log(`✓ Generated ${name} (${actualSize}x${actualSize})`);
    }

    // Create .icns file using iconutil
    const icnsPath = join(iconDir, 'icon.icns');
    const { execSync } = await import('child_process');
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'inherit' });
      console.log(`✓ Generated ${icnsPath}`);
      
      // Clean up iconset directory
      const { rmSync } = await import('fs');
      rmSync(iconsetDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`✗ Failed to generate .icns:`, error.message);
    }
  }

  // Generate Windows .ico file
  console.log('\nGenerating Windows icon...');
  const icon256 = await createWalletIcon(256);
  const icoPath = join(iconDir, 'icon.ico');
  
  // Create multi-resolution ICO using sharp
  // Note: sharp doesn't directly support ICO, so we'll create a 256x256 PNG
  // electron-builder can convert PNG to ICO automatically
  const icoPngPath = join(iconDir, 'icon_256.png');
  await sharp(icon256).toFile(icoPngPath);
  console.log(`✓ Created ${icoPngPath} (electron-builder will convert to .ico)`);

  console.log('\n✓ Icon generation complete!');
  console.log('\nNext steps:');
  console.log('1. Icons are ready in build/icons/');
  console.log('2. Update package.json to reference the icons');
  console.log('3. Rebuild your app to use the new icons');
}

main().catch(console.error);

