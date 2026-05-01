# Release Notes - v1.0.9

## Summary
Version 1.0.9 introduces significant performance improvements to the media library, enhanced visual previews, and several critical stability fixes for the playback engine.

## 🚀 Performance & Scanning
- **Optimized Library Scanning**: The scanner now recursively skips hidden directories (e.g., `.git`, `.cache`) and system folders (e.g., `$RECYCLE.BIN`).
- **Aggressive Exclusion Rules**: Explicitly ignores application data folders like `Library`, `Cache`, `node_modules`, and `logs` to prevent indexing system-level media files.
- **High-Performance Rendering**: Implemented lazy-loading in the Library View, allowing the UI to remain fluid even with libraries exceeding 70,000 items.
- **Verbose Scanner Feedback**: Added real-time terminal logging (`ENTERING` / `SKIPPING`) and UI progress metrics, including item counts, elapsed time, and ETA calculations.

## 📺 Media Experience
- **Dynamic Previews**: Added thumbnail support for both images and videos directly in the library listing.
- **Video Visibility Fix**: Forced `yuv420p` pixel format during transcoding to resolve "audio-only" or "black screen" playback issues in Chromium.
- **Improved Snapshots**: Thumbnails now seek 1 second into videos to ensure a clear preview instead of a black start frame.
- **Image Overlays**: Implemented a non-playback preview overlay for images and videos using a high-performance React Portal.

## 🛠️ Stability & UX
- **Playback Lock**: Fixed a critical state synchronization bug where toggling mute or volume would cause the UI timer to reset or the playlist to jump to the first song.
- **Global Key Bindings**: Added the **`M`** key shortcut to toggle mute globally.
- **Smart Focus Handling**: Shortcuts are automatically disabled when typing in search or input fields to prevent accidental triggers.
- **Metadata Tooltips**: Added full file paths with truncation and hover tooltips to all library items.

## 🐞 Bug Fixes
- Resolved `ffprobe` crashes on malformed or inaccessible system files.
- Fixed a loop where stale position data from the background would fight with the local high-precision timer.
- Improved media type detection for mixed-extension folders.
