const {Messager, WakeUp} = require("./services");
const pckg = require('./package.json');

const services = (view) => {
  let messagerService = new Messager(view);
  let taskWakeUpService = new WakeUp(view);

  view.webContents.ipc.handle("Messager_start", (event, args) => {
    messagerService.start(args);
  });
  view.webContents.ipc.handle("Messager_stop", (event, args) => {
    messagerService.stop(args);
  });

  view.webContents.ipc.handle("WakeUp_isTaskCreated", (event, args) => {
    return taskWakeUpService.isTaskCreated(args);
  });
  view.webContents.ipc.handle("WakeUp_createTask", (event, args) => {
    return taskWakeUpService.createTask(args);
  });
  view.webContents.ipc.handle("WakeUp_deleteTask", (event, args) => {
    return taskWakeUpService.deleteTask(args);
  });
  view.webContents.ipc.handle('version', () => pckg.version);

  return {
    destroy: () => {
      messagerService.stop();

      messagerService = null;
      taskWakeUpService = null;
    }
  }
}

module.exports = {
  services,
  tabs: (tabsClass) => {
    tabsClass.tabs.webContents.ipc.handle("NewWindow", () => {
      const view = tabsClass.createViewContent();
      const srvcs = services(view);
      tabsClass.onDestroy(view, srvcs.destroy);

      return Promise.resolve(view.webContents.id);
    });

    tabsClass.tabs.webContents.ipc.handle("ActiveWindow", (event, id) => {
      tabsClass.setVisibleViewContent(id);
      return Promise.resolve();
    });

    tabsClass.tabs.webContents.ipc.handle("CloseWindow", (event, id) => {
      tabsClass.closeViewContent(id);
      return Promise.resolve();
    });
  }
}
