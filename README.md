![Minidit](.github/assets/social-preview.png)

# Minidit

A lightweight, simple text editor for note-taking on Windows and macOS.

Minidit keeps the simplicity of Windows Notepad while adding a few conveniences such as tabs, encoding detection, and regex search. See the [specification](https://github.com/t-hamano/minidit/issues/1) and the [implementation roadmap](https://github.com/t-hamano/minidit/issues/2).

## Installation

Download the installer for your OS from the [Releases page](https://github.com/t-hamano/minidit/releases).

- **macOS**: Open the `.dmg` file and drag Minidit to the Applications folder. The app is signed and notarized by Apple.
- **Windows**: Run the `-setup.exe` installer.

Minidit checks for updates at startup and offers to install them. You can turn this off in the settings, and check manually from About Minidit.

### Windows SmartScreen warning

The Windows installer is not code signed, so Microsoft Defender SmartScreen may show "Windows protected your PC" when you run it. To continue, click **More info**, then **Run anyway**. Only do this for installers downloaded from the Releases page of this repository.

## Development

### Requirements

- Node.js (see [`.nvmrc`](.nvmrc)) and [pnpm](https://pnpm.io/)
- Rust (stable)
- The [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

### Commands

```sh
pnpm install       # Install dependencies
pnpm tauri dev     # Run the app in development mode
pnpm tauri build   # Build the app and installers
pnpm lint          # Lint JS and CSS
pnpm format        # Format files with Prettier
pnpm type-check    # Type check TypeScript
```

## License

[GPL-2.0-or-later](LICENSE)
