# Icons

Place your icon assets in this directory.

## Generating Icons

The easiest way to generate all required icon sizes is using the Tauri CLI:

```bash
cargo tauri icon /path/to/source.png
```

This command will generate the following files in this directory:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

## Source Image Requirements

- **Format:** PNG with transparency
- **Size:** At least 1024×1024 pixels for best results
- **Shape:** Square aspect ratio

The Tauri CLI will automatically resize and convert the source image into all platform-specific formats required by the application bundle.
