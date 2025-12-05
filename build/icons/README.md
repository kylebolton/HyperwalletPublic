# HyperWallet App Icons

## Icon Design

The HyperWallet app icon features:
- **Gradient background**: Indigo (#6366f1) to Purple (#8b5cf6) gradient
- **Wallet design**: Modern wallet illustration with card slots
- **Letter "H"**: Stylized "H" for HyperWallet
- **Professional appearance**: Clean, modern design suitable for a finance app

## Generated Files

- `icon.png` - 1024x1024 PNG (used by electron-builder for all platforms)
- `icon.icns` - macOS icon set (for dock and app)
- `icon_256.png` - 256x256 PNG (for Windows ICO conversion)
- `icon.svg` - Source SVG file

## Regenerating Icons

To regenerate the icons (if you modify the design):

```bash
npm run icons
```

Or directly:
```bash
node build/icons/create-icon.mjs
```

## Icon Configuration

Icons are configured in `package.json`:
- **macOS**: Uses `icon.icns` for native macOS icon support
- **Windows**: Uses `icon.png` (electron-builder converts to .ico)
- **Linux**: Uses `icon.png`

## Requirements

- `sharp` package (installed as dev dependency)
- Node.js 18+ (for ES modules)

## Notes

- The icons are automatically included in the build process
- electron-builder will use these icons when packaging the app
- Icons appear in:
  - macOS: Dock, Finder, About window, App Switcher
  - Windows: Taskbar, Start menu, File Explorer
  - Linux: Application launcher, window decorations

