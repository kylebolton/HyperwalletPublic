#!/usr/bin/env node

/**
 * Generate app icons from SVG
 * This script creates PNG icons in various sizes for macOS and Windows
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sizes = {
  mac: [16, 32, 64, 128, 256, 512, 1024],
  win: [16, 32, 48, 64, 128, 256],
  png: 1024
};

const iconDir = path.join(__dirname);
const svgPath = path.join(iconDir, 'icon.svg');

// Check if ImageMagick is available
function hasImageMagick() {
  try {
    execSync('which convert', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Generate PNG from SVG using ImageMagick
function generatePNG(size, outputPath) {
  try {
    execSync(`convert -background none -resize ${size}x${size} "${svgPath}" "${outputPath}"`, {
      stdio: 'inherit'
    });
    console.log(`✓ Generated ${outputPath} (${size}x${size})`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to generate ${outputPath}:`, error.message);
    return false;
  }
}

// Generate macOS .icns file
function generateICNS() {
  const iconsetDir = path.join(iconDir, 'icon.iconset');
  
  // Create iconset directory
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  // Generate all required sizes for macOS
  const macSizes = [
    { size: 16, scale: 1 },
    { size: 32, scale: 1 },
    { size: 32, scale: 2 },
    { size: 64, scale: 1 },
    { size: 128, scale: 1 },
    { size: 128, scale: 2 },
    { size: 256, scale: 1 },
    { size: 256, scale: 2 },
    { size: 512, scale: 1 },
    { size: 512, scale: 2 },
    { size: 1024, scale: 1 },
    { size: 1024, scale: 2 }
  ];

  console.log('Generating macOS icon set...');
  for (const { size, scale } of macSizes) {
    const actualSize = size * scale;
    const filename = scale === 1 
      ? `icon_${size}x${size}.png`
      : `icon_${size}x${size}@${scale}x.png`;
    const outputPath = path.join(iconsetDir, filename);
    generatePNG(actualSize, outputPath);
  }

  // Create .icns file
  const icnsPath = path.join(iconDir, 'icon.icns');
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, {
      stdio: 'inherit'
    });
    console.log(`✓ Generated ${icnsPath}`);
    
    // Clean up iconset directory
    fs.rmSync(iconsetDir, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error(`✗ Failed to generate .icns:`, error.message);
    return false;
  }
}

// Generate Windows .ico file
function generateICO() {
  const icoPath = path.join(iconDir, 'icon.ico');
  const sizes = sizes.win.map(s => `${s}x${s}`).join(',');
  
  try {
    // Generate a 256x256 PNG first
    const png256 = path.join(iconDir, 'icon_256.png');
    generatePNG(256, png256);
    
    // Convert to ICO (ImageMagick can create multi-resolution ICO)
    execSync(`convert "${png256}" -define icon:auto-resize=256,128,64,48,32,16 "${icoPath}"`, {
      stdio: 'inherit'
    });
    console.log(`✓ Generated ${icoPath}`);
    
    // Clean up temp file
    fs.unlinkSync(png256);
    return true;
  } catch (error) {
    console.error(`✗ Failed to generate .ico:`, error.message);
    return false;
  }
}

// Main execution
function main() {
  console.log('Generating app icons...\n');

  if (!fs.existsSync(svgPath)) {
    console.error(`✗ SVG file not found: ${svgPath}`);
    process.exit(1);
  }

  if (!hasImageMagick()) {
    console.error('✗ ImageMagick not found. Please install it:');
    console.error('  brew install imagemagick');
    process.exit(1);
  }

  // Generate 1024x1024 PNG (for electron-builder)
  const png1024 = path.join(iconDir, 'icon.png');
  generatePNG(1024, png1024);

  // Generate macOS icon
  if (process.platform === 'darwin') {
    generateICNS();
  }

  // Generate Windows icon
  generateICO();

  console.log('\n✓ Icon generation complete!');
}

main();

