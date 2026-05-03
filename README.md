# ClipVault

ClipVault is a modern, high-performance desktop application built with Electron and Vue 3 that serves as a powerful frontend for `yt-dlp`. It provides a streamlined, user-friendly interface for downloading videos and audio from YouTube other supported platforms.

## 📸 Screenshots

<table align="center">
  <tr>
    <td align="center">
      <img src="screenshots/01-Screenshot-Start-Download.png" width="400" alt="ClipVault Main Interface"><br>
      <em>Main Window, Starting Download</em>
    </td>
    <td align="center">
      <img src="screenshots/04-Screenshot-Settings.png" width="400" alt="Settings View"><br>
      <em>Settings View</em>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/02-Screenshot-Library-View-Detail.png" width="400" alt="Library Detail View"><br>
      <em>Visual Library with Thumbnails</em>
    </td>
    <td align="center">
      <img src="screenshots/03-Screenshot-Library-View-Compact.png" width="400" alt="Library Compact View"><br>
      <em>Compact Shortlist View</em>
    </td>
  </tr>
</table>

## Key Features

- **Broad Compatibility**: Leverage the power of `yt-dlp` to download from a vast range of websites beyond just YouTube.
- **Modern User Experience**: A clean, responsive interface built with Vue 3, Tailwind CSS, and shadcn-vue components.
- **Smart Quality Selection**: Choose between highest available quality, specific formats (MP4, MKV), or audio-only extraction.
- **Automated Dependency Management**: ClipVault automatically handles the setup and updates for `yt-dlp` and `FFmpeg` on first run.
- **Subtitle Support**: Select and embed subtitles in multiple languages directly into your downloads.
- **Integrated Library**: Track and manage your download history and local library directly within the application.
- **Persistent Settings**: Custom download directories and preferences are managed via a secure local store.

## Installation

### Binary Downloads

*Coming soon: Pre-built binaries for Windows, macOS, and Linux will be available in the Releases section.*

### Building from Source

To build ClipVault manually, ensure you have [Node.js](https://nodejs.org/) (LTS) installed on your system.

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/clipvault.git
   cd clipvault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the application**
   ```bash
   # Build for your current platform
   npm run build
   ```

The installer will be generated in the `release/` directory.

## Development

ClipVault is built using a modern frontend stack integrated with Electron.

### Tech Stack

- **Framework**: Electron
- **Frontend**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS & shadcn-vue
- **Language**: TypeScript
- **Storage**: electron-store

### Commands

- `npm run dev`: Starts the Vite development server and launches the Electron application with hot-reload enabled.
- `npm run build`: Compiles the frontend assets, transpiles the Electron main process, and packages the app using electron-builder.
- `npm run preview`: Previews the production build of the frontend.

## Project Structure

- `electron/`: Main process logic, IPC handlers, and binary management.
- `src/`: Vue 3 renderer process (UI components, styling, and state).
- `public/`: Static assets for the application.

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request or open an issue for feature requests and bug reports.

## Author

- **Nick Weschkalnies** - [@medianetic](https://github.com/medianetic) - [nick@weschkalnies.de](mailto:nick@weschkalnies.de)

## Support

😊 If you like, you can <a href="https://buymeacoffee.com/weschkalnies">buy me a coffee</a>

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
