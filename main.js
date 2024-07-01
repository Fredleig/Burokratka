const {app, BaseWindow, Menu, Tray} = require('electron');
const {getPublicPath} = require("./utils");
const emitters = require('./Emitters')
const {TabsViewContent} = require('./services');

function createTray() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Выход',
      click: () => {
        BaseWindow.getAllWindows().forEach((w) => w.destroy());
        app.quit();
      }
    }
  ]);

  const tray = new Tray(getPublicPath() + 'iconTrey.png');
  tray.setToolTip('Бюракратка');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    BaseWindow.getAllWindows().shift().show();
  });

  return tray;
}

const createWindow = () => {
  const win = new BaseWindow({
    width: 800,
    height: 800,
    minHeight: 400,
    minWidth: 400,
    // show: false,
    autoHideMenuBar: true,
  });

  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  

  app.whenReady().then(() => {
    const win = createWindow();
    createTray();
    const tabsView = new TabsViewContent(app, win);
    emitters.tabs(tabsView);

    app.on('second-instance', () => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    });

    win.on('close', (ev) => {
      if (win.isVisible()) {
        ev.preventDefault();
        win.hide();
      }
    });
  });
}


