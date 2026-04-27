# 🎬 Ginger Media v1.0.8 - The Video Controls Update

Version 1.0.8 brings a significant upgrade to the video playback experience, introducing full VLC-style controls for stopping, full-screening, and reshaping media — all without leaving the player.

## ✨ New Features

### ⏹️ Stop Button
- **Dedicated Stop Control**: A new **Stop** button sits alongside Previous, Play/Pause, and Next in the transport bar.
- **Clean Reset**: Stopping a track immediately pauses playback and resets the position to the beginning, matching expected media-player behaviour.
- **Visual Feedback**: The button glows red on hover to clearly distinguish it from the softer pause action.

### 🖥️ True Video Fullscreen
- **Native Fullscreen**: Clicking the Fullscreen button now calls the browser-native `requestFullscreen()` API directly on the video container, making the video occupy the **entire monitor** rather than just toggling the window border.
- **Smart Toggle Icon**: The button switches between a Maximize and Minimize icon to reflect the current fullscreen state, so you always know how to get back.
- **Fallback for Non-Video**: When no video is loaded the button falls back to the Electron window-level fullscreen toggle, preserving the existing behaviour for audio-only sessions.

### 📐 Aspect Ratio Control (VLC-style)
- **Aspect Ratio Picker**: A new **Crop / Ratio** button appears in the right-side controls whenever a video file is playing.
- **Seven Presets** — matching the VLC experience:
  | Label | Behaviour |
  |-------|-----------|
  | **Auto** | Original encoded ratio, letterboxed to fit (default) |
  | **16:9** | Forces widescreen — fills and crops to 16:9 |
  | **4:3** | Classic TV ratio |
  | **1:1** | Perfect square |
  | **21:9** | Ultra-wide / cinematic |
  | **Fill** | Stretches to fill the entire player area |
  | **Crop** | Scales and crops to fill without distortion |
- **Highlighted State**: The button turns accent-blue when any non-Auto ratio is active, so you can tell at a glance that a custom ratio is applied.
- **Dropdown Menu**: Selecting a ratio from the floating menu applies it instantly with no reload required.

## 🛠️ Stability & Bug Fixes

### 🎞️ Video Rendering
- **Object-fit Consistency**: Removed duplicate Tailwind `object-contain` class conflicts when switching between forced and auto aspect ratios.
- **Container ID**: The video player container now has a stable `id="video-player-container"`, which both the fullscreen handler and future overlay features can reliably target.

### ⚡ Build & Dependencies
- **Vite Patches**: Applied `npm audit fix` to address high-severity Vite dev-server vulnerabilities (`GHSA-4w7w-66w2-5vf9`, `GHSA-v2wj-q39q-566r`, `GHSA-p9ff-h696-f583`).
- **Undici Update**: Resolved multiple high-severity undici WebSocket and HTTP smuggling advisories.
- **Clean Build**: `electron-forge make` produces a valid `.deb` distributable with zero TypeScript errors.

---
*Thank you for being part of the Ginger Media community! Your reports help us build a better player.*
