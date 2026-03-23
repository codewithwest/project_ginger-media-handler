import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'path';

export class TrayService {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  createTray() {
    // Attempt to find an icon
    const iconPath = this.getIconPath();
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16, quality: 'best' });

    // Fallback if no icon found? Electron might show transparent or default
    // On Linux/Windows, we really need an icon.

    this.tray = new Tray(icon);
    this.tray.setToolTip('Ginger Media Player');

    this.updateContextMenu();

    this.tray.on('double-click', () => {
      this.toggleWindow();
    });

    this.tray.on('click', () => {
      this.toggleWindow();
    });
  }

  private getIconPath(): string {
    return app.isPackaged 
      ? path.join(process.resourcesPath, 'logo.png')
      : path.join(app.getAppPath(), 'public', 'images', 'logo.png');
  }

  private updateContextMenu() {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show/Hide',
        click: () => this.toggleWindow()
      },
      { type: 'separator' },
      {
        label: 'Play / Pause',
        click: () => {
          // We will emit an IPC message or call service directly
          // For now, let's assume we can emit to renderer or call main service
          app.emit('playback:toggle');
        }
      },
      {
        label: 'Next',
        click: () => app.emit('playback:next')
      },
      {
        label: 'Previous',
        click: () => app.emit('playback:previous')
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private toggleWindow() {
    if (!this.mainWindow) return;

    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
