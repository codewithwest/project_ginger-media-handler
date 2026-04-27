# 🎬 Ginger Media v1.0.8 - The Video Controls Update

Version 1.0.8 is a comprehensive upgrade to the video playback experience. It introduces VLC-style media controls, a premium fullscreen overlay, keyboard shortcuts, smarter file handling, and a polish pass across the entire player UI.

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

### 🖥️ Premium Fullscreen Controls Overlay
- **Auto-Hiding HUD**: When a video enters fullscreen a polished controls overlay appears at the bottom of the screen. It fades out automatically after **3.5 seconds** of inactivity and reappears the moment the mouse moves.
- **Cursor Management**: The mouse cursor turns invisible alongside the controls, giving a true cinema feel. Moving the mouse restores both immediately.
- **Three-Zone Layout**: The overlay is divided into a clear hierarchy — track title & folder name at the top, a full-width seek bar in the middle, and transport + volume at the bottom.
- **Glowing 76 px Play Button**: The primary play/pause button scales up significantly in fullscreen with a white halo ring effect.
- **Custom Seek & Volume Tracks**: Both sliders render a custom filled track with a glowing white progress bar — the native browser thumb is hidden and an invisible `<input>` handles interaction on top.
- **Volume Percentage Readout**: The volume percentage (`75%`) is displayed live next to the slider.
- **Exit Fullscreen Button**: A labelled pill button (`Exit Fullscreen`) sits in the bottom-right corner of the overlay for discoverability.
- **Deep Gradient Scrim**: A `from-black via-black/75` gradient covers the lower half of the frame so controls remain readable over any video.

### ⌨️ Space Bar Play / Pause
- **Global Keyboard Shortcut**: Pressing **Space** anywhere in the app toggles play/pause instantly.
- **Input-Aware**: The shortcut is suppressed when focus is inside an `<input>`, `<textarea>`, or any `contentEditable` element, so typing is never interrupted.

### 📂 Instant Auto-Play on File Open
- **Open = Play**: Picking a file via the **Open Media** dialog now immediately starts playback of the first selected file, regardless of whether something was already playing.
- **Multi-File Selection**: When multiple files are chosen at once, the first file plays immediately and the rest are appended to the queue — no manual action required.
- The previous behaviour (only auto-playing when the player was stopped and the playlist was empty) has been removed.

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
