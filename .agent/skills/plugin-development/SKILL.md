---
name: plugin-development
description: Instructions on how to create and register a new media provider plugin for the Ginger Media Handler. Use this when extending the app to support new remote sources like YouTube, Soundcloud, or custom streaming hubs.
---

# Plugin Development Skill

Ginger Media Handler loads third-party extensions from the user's `userData/plugins` directory.

## Step 1: Create the Plugin Folder
Inside the user's app data path (usually `~/.config/ginger-media-handler/plugins/` on Linux), create a directory for your plugin: `my-custom-provider`.

## Step 2: The `manifest.json`
Every plugin requires a manifest.
```json
{
  "name": "my-custom-provider",
  "version": "1.0.0",
  "description": "Stream media from my custom source",
  "main": "index.js",
  "settingsSchema": [
    { "id": "username", "label": "Username", "type": "string", "default": "" }
  ]
}
```

## Step 3: Implement `index.js`
The plugin must export an `init(api)` function. The `api` object provides access to `logger`, `providers`, `ui`, and `settings`.

```javascript
export async function init(api) {
  api.logger.info("Initializing My Custom Provider");

  const username = api.settings.get('username');

  // Register the Provider
  api.providers.register({
    id: "custom-provider-01",
    name: "Custom Hub",
    
    // Browse folders/categories
    browse: async (path) => {
      return [
        { id: "stream-1", type: "provider", providerId: "custom-provider-01", title: "Live Radio", mediaType: "audio" }
      ];
    },
    
    // Resolve abstract source into a playable URL
    resolve: async (source) => {
      // Must return a playable URL (HTTP stream or local path)
      return "https://my-radio.com/stream.mp3"; 
    },
    
    // Implement global search
    search: async (query) => {
      return [];
    }
  });
}
```

## Step 4: Testing
After writing the plugin files to the testing directory, restart the Electron application. The Main process will automatically parse `manifest.json`, load `index.js`, and emit the IPC signals so the React UI can dynamically render the new provider in the Network/Plugins tab.
