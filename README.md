# Minidit

A lightweight, simple text editor for note-taking on Windows and macOS.

Minidit keeps the simplicity of Windows Notepad while adding a few conveniences such as tabs, encoding detection, and regex search. See the [specification](https://github.com/t-hamano/minidit/issues/1) and the [implementation roadmap](https://github.com/t-hamano/minidit/issues/2).

> [!NOTE]
> Minidit is under early development and is not ready for use yet.

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
