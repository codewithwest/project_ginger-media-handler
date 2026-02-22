---
name: electron-ipc-wiring
description: A structured guide on how to safely cross the IPC bridge between the React renderer and the Electron Main process. Use this when you need the UI to trigger a backend service (e.g., interacting with the filesystem, media player, or jobs).
---

# Electron IPC Wiring Skill

Ginger Media Handler uses Context Isolation and a strictly typed preload script. **You cannot use `require('electron')` in the React renderer.** You must route all communication through the `window.electronAPI`.

## Implementation Checklist

### 1. Define the Type Contract
Always start in `src/shared/types/index.ts`. Add your request and response types.
```typescript
export interface MyActionRequest {
    id: string;
    payload: string;
}
export type MyActionResponse = { success: boolean };
```

### 2. Update the Preload Script
Open `src/preload/index.ts`. Add your method to the `electronAPI` object. Use `ipcRenderer.invoke` for async operations.
```typescript
  myFeature: {
    doAction: (req: MyActionRequest): Promise<MyActionResponse> => 
      ipcRenderer.invoke('myFeature:do-action', req),
  }
```

### 3. Implement the Main Process Handler
Open `src/main/index.ts` (or the specific service class). Inside `registerIpcHandlers`:
```typescript
  ipcMain.handle('myFeature:do-action', async (_event, req) => {
    // Call the relevant service class here
    const result = await myService.execute(req.payload);
    return { success: true };
  });
```

### 4. Call from the Renderer (React)
In your React component (`src/renderer/components/...`), call the API:
```typescript
const handleAction = async () => {
    const res = await window.electronAPI.myFeature.doAction({ id: '1', payload: 'test' });
    console.log(res.success);
};
```

**Security Warning**: Never pass raw user input to `exec` or `spawn` in the main process without sanitization.
