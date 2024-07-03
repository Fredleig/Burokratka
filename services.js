const dayjs = require("dayjs");
const ews = require("ews-javascript-api");
const { exec } = require("child_process");
const os = require("os");
const fs = require("fs");
const { getPublicPath } = require("./utils");
const { WebContentsView } = require("electron");
const path = require("path");
const EventEmitter = require("node:events");

const execAsync = (cmd, options) =>
  new Promise((resolve, reject) => {
    exec(
      "@chcp 65001 >nul & " + cmd,
      { ...options, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (stdout) {
          return resolve({ stdout });
        }

        if (stderr) {
          return reject({ err: stderr, message: stderr });
        }

        if (error) {
          return reject({ err: error, message: String(error) });
        }
      }
    );
  });

class LockSimultaneousCall {
  static #isLock = false;
  static #emitter = new EventEmitter();

  static async exec(fn) {
    if (!LockSimultaneousCall.#isLock) {
      LockSimultaneousCall.#isLock = true;
      return fn()
        .then((res) => {
          LockSimultaneousCall.#emitter.emit("resolve", res);
          return res;
        })
        .catch((err) => {
          LockSimultaneousCall.#emitter.emit("reject", err);
          return err;
        })
        .finally(() => (LockSimultaneousCall.#isLock = false));
    } else {
      return new Promise((resolve, reject) => {
        LockSimultaneousCall.#emitter.once("resolve", resolve);
        LockSimultaneousCall.#emitter.once("reject", reject);
      });
    }
  }
}

class WakeUp {
  constructor(win) {
    this.win = win;
  }

  async isTaskCreated() {
    try {
      const { stdout } = await execAsync("schtasks /query /fo list /tn \\MSMZ");

      return Promise.resolve(stdout?.search("MSMZ") !== -1);
    } catch (err) {
      if (err?.message?.search("cannot find the file") !== -1)
        return Promise.resolve(false);
      this.#addLog("[isTaskCreated] - " + err, true);
      return Promise.reject(err);
    }
  }

  async createTask(time) {
    try {
      await this.createConfig(time);
      const { stdout } = await execAsync(
        "schtasks /Create /XML task.xml /Tn MSMZ"
      );
      console.log(stdout);

      this.#addLog("Задача создана");
      return true;
    } catch (err) {
      console.error("[createTask]", err);
      this.#addLog("[createTask] - " + err.message, true);
    }
  }

  async deleteTask() {
    try {
      await execAsync('schtasks /Delete /TN "\\MSMZ" /F');
      this.#addLog("Задача удалена");
      return true;
    } catch (err) {
      console.error("[deleteTask]", err);
      this.#addLog("[deleteTask] - " + err.message, true);
    }
  }

  async createConfig(time) {
    try {
      const userInfo = await this.#getUserInfo();

      if (userInfo) {
        const timeArr = time.split(":");
        let patternTask = await fs.promises.readFile(
          getPublicPath() + "task.txt",
          "utf-8"
        );

        patternTask = patternTask
          .replace("$DATE_CREATE_TASK", dayjs().format("YYYY-MM-DDTHH:mm:ss"))
          .replace("$USER_NAME", userInfo.name)
          .replace("$USER_ID", userInfo.id)
          .replace(
            "$DATE_TRIGGER",
            dayjs()
              .set("hour", timeArr[0])
              .set("minute", timeArr[1])
              .set("millisecond", 0)
              .subtract(5, "minute")
              .format("YYYY-MM-DDTHH:mm:ss")
          );

        return await fs.promises.writeFile("./task.xml", patternTask);
      }
    } catch (err) {
      console.log("[createConfig]", err);
      return Promise.reject(err);
    }
  }

  async #getUserInfo() {
    try {
      const name = os.hostname() + "\\" + os.userInfo().username;
      const { stdout } = await execAsync(
        `wmic useraccount where name='${os.userInfo().username}' get sid`
      );
      const id = stdout.replace("SID", "").trim();

      return { id, name };
    } catch (err) {
      console.error("[getUserInfo]", err);
      this.#addLog("[getUserInfo] - " + err, true);
    }
  }

  #addLog(text, isError) {
    this.win.webContents.send("info_log", { text, isError });
  }
}

class Vpn {
  constructor(win) {
    this.win = win;
    this.pathVpn = "C:\\Program Files (x86)\\CheckPoint\\Endpoint Connect";

    this.timerCheck = undefined;
    this.stopConnect = new AbortController();
  }

  async #isConnected() {
    try {
      const { stdout } = await execAsync("trac info", {
        cwd: this.pathVpn,
        signal: this.stopConnect.signal,
      });

      if (stdout?.search("status: Connecting") !== -1) {
        await execAsync("trac disconnect", {
          cwd: this.pathVpn,
          signal: this.stopConnect.signal,
        });
        return Promise.resolve(false);
      }

      return Promise.resolve(stdout?.search("status: Connected") !== -1);
    } catch (err) {
      if (err.code === "ABORT_ERR") return Promise.reject();

      console.error(`statusVpn: ${err}`);
      this.#addLog(
        `${dayjs().format("DD.MMMM.YYYY HH:mm")} [statusVpn] - ${err.message}`,
        true
      );
      return Promise.reject();
    }
  }

  async connect(config) {
    try {
      this.stopConnect = new AbortController();
      const isConnected = await this.#isConnected();
      if (isConnected) return Promise.resolve(true);

      const { stdout } = await execAsync(
        `trac connect -s ИП ВПН -u "${config.vpnUser}" -p "${config.vpnPassword}"`,
        { cwd: this.pathVpn, signal: this.stopConnect.signal }
      );

      if (stdout) {
        const isConnect =
          stdout.search("Connection was successfully") !== -1 ||
          stdout.search("Client is already connected") !== -1;

        if (!isConnect) {
          if (
            stdout.search("previous connection is currently on progress") !== -1
          ) {
            return await this.connect(config);
          }

          this.#addLog(
            `${dayjs().format(
              "DD.MMMM.YYYY HH:mm"
            )} [connectVpn] - Не смог подключиться к впн ${stdout}`,
            true
          );
        }

        return Promise.resolve(isConnect);
      }

      return Promise.resolve(false);
    } catch (err) {
      if (err.code === "ABORT_ERR") {
        return Promise.resolve(false);
      }

      if (err.stderr) {
        console.error(`statusVpn: ${err.stderr}`);
        this.#addLog(
          `${dayjs().format("DD.MMMM.YYYY HH:mm")} [connectVpn] - ${
            err.stderr
          }`,
          true
        );
      }

      return Promise.resolve(false);
    }
  }

  #addLog(text, isError) {
    this.win.webContents.send("info_log", { text, isError });
  }

  stop() {
    this.timerCheck && clearTimeout(this.timerCheck);
    this.stopConnect.abort("stop");
  }
}

class Messager {
  constructor(win) {
    this.win = win;

    this.config;
    this.retryConnectVpn = 0;
    this.timers = [];
    this.vpnService = new Vpn(this.win);
  }

  #startTimer(time, fn, isEnd) {
    const timeArr = time.split(":");
    let targetDate = dayjs()
      .set("hour", timeArr[0])
      .set("minute", timeArr[1])
      .set("millisecond", 0);
    const currentDate = dayjs();
    const currentDay = dayjs().day();

    if (isEnd && currentDay === 5) {
      targetDate = targetDate.subtract(75, "minute"); // сокращённыйц день пятница
    }

    if (currentDay === 6) {
      targetDate = targetDate.add(2, "day");

      this.#addLog(
        `Запланирована отправка ${targetDate.format("DD.MM.YY HH:mm")}`,
        isEnd
      );
      return setTimeout(fn, targetDate.diff(currentDate, "millisecond"));
    }

    if (currentDay === 0) {
      targetDate = targetDate.add(1, "day");

      this.#addLog(
        `Запланирована отправка ${targetDate.format("DD.MM.YY HH:mm")}`,
        isEnd
      );
      return setTimeout(fn, targetDate.diff(currentDate, "millisecond"));
    }

    if (currentDate.isAfter(targetDate)) {
      targetDate = targetDate.add(currentDay === 5 ? 3 : 1, "day");
      if (isEnd && currentDay === 4)
        targetDate = targetDate.subtract(75, "minute"); // сокращённыйц день пятница

      this.#addLog(
        `Запланирована отправка ${targetDate.format("DD.MM.YY HH:mm")}`,
        isEnd
      );
      return setTimeout(fn, targetDate.diff(currentDate, "millisecond"));
    } else {
      this.#addLog(
        `Запланирована отправка ${targetDate.format("DD.MM.YY HH:mm")}`,
        isEnd
      );
      return setTimeout(fn, targetDate.diff(currentDate, "millisecond"));
    }
  }

  async #sendMessage(title, text) {
    if (
      !(await LockSimultaneousCall.exec(() =>
        this.vpnService.connect(this.config)
      ))
    ) {
      return Promise.reject(false);
    }

    const service = new ews.ExchangeService(ews.ExchangeVersion.Exchange2013);
    service.Credentials = new ews.WebCredentials(
      this.config.email,
      this.config.password
    );
    service.Url = new ews.Uri("https://mail.sibintek.ru/EWS/Exchange.asmx");

    const emailMessage = new ews.EmailMessage(service);
    const messageBody = new ews.MessageBody();
    emailMessage.ToRecipients.Add(this.config.to);
    this.config.copyTo && emailMessage.CcRecipients.Add(this.config.copyTo);
    emailMessage.Subject = title;
    messageBody.BodyType = ews.BodyType.Text;
    messageBody.Text = text;
    emailMessage.Body = messageBody;

    return emailMessage
      .SendAndSaveCopy()
      .then(() => {
        this.win.webContents.send("info_log", {
          text: `${dayjs().format("DD.MMMM.YYYY HH:mm")} [${title}] - Успех`,
          isError: false,
        });
        return true;
      })
      .catch((err) => {
        console.log(err);
        this.win.webContents.send("info_log", {
          text: `${dayjs().format("DD.MMMM.YYYY HH:mm")} [${title}] - Ошибка`,
          isError: true,
        });
        return false;
      });
  }

  #retrySendMessage(configDay, fn, isEnd) {
    if (this.retryConnectVpn < 12) {
      this.retryConnectVpn += 1;
      return setTimeout(
        () => fn().then(() => (this.retryConnectVpn = 0)),
        120000
      );
    } else {
      this.retryConnectVpn = 0;
      return this.#startTimer(configDay, fn, isEnd);
    }
  }

  stop() {
    this.vpnService.stop();
    this.timers.forEach((t) => t && clearTimeout(t));
    this.timers = [];
    this.config = undefined;
    this.retryConnectVpn = 0;
  }

  start(config) {
    const validConf = this.#valid(config);

    if (validConf) {
      this.config = validConf;
      const startDay = () =>
        this.#sendMessage("Начало дня", this.config.start_body)
          .then(
            () =>
              (this.timers[0] = this.#startTimer(validConf.startDay, startDay))
          )
          .catch(
            () =>
              (this.timers[0] = this.#retrySendMessage(
                validConf.endDay,
                startDay
              ))
          );
      const endDay = () =>
        this.#sendMessage("Конец дня", this.config.end_body)
          .then(
            () =>
              (this.timers[1] = this.#startTimer(
                validConf.endDay,
                endDay,
                true
              ))
          )
          .catch(
            () =>
              (this.timers[1] = this.#retrySendMessage(
                validConf.endDay,
                endDay,
                true
              ))
          );

      this.timers = [
        this.#startTimer(validConf.startDay, startDay),
        this.#startTimer(validConf.endDay, endDay, true),
      ];
    }
  }

  #addLog(text, isEnd) {
    this.win.webContents.send("Messager_log/add", { text, isEnd });
  }

  #valid(config) {
    if (
      config.vpnUser.search(/\\/gu) !== -1 ||
      config.vpnUser.search(/\\/gu) !== -1
    ) {
      this.#addLog(
        `${dayjs().format(
          "DD.MMMM.YYYY HH:mm"
        )} [connectVpn] - не безопасные символы \\`,
        true
      );
      return false;
    }

    config.vpnUser.replace(/\s+/gu, "");
    config.vpnPassword.replace(/\s+/gu, "");

    return config;
  }
}

class TabsViewContent {
  constructor(app, win) {
    this.heightTabs = 55;
    this.win = win;
    this.app = app;
    this.tabs = this.createTabs();
  }

  createTabs() {
    const view = new WebContentsView({
      webPreferences: {
        // nodeIntegration: true,
        sandbox: true,
        contextIsolation: true,
        preload: path.join(__dirname, "preloadMain.js"),
        disableHtmlFullscreenWindowResize: true,
      },
    });

    this.win.contentView.addChildView(view);
    view.webContents.loadFile("./tabs/index.html");
    view.setBounds({
      x: 0,
      y: 0,
      width: this.win.getBounds().width,
      height: this.heightTabs,
    });

    this.win.on("resize", () => {
      view.setBounds({
        x: 0,
        y: 0,
        width: this.win.getBounds().width,
        height: this.heightTabs,
      });
    });

    return view;
  }

  createViewContent() {
    const view = new WebContentsView({
      webPreferences: {
        // nodeIntegration: true,
        sandbox: true,
        contextIsolation: true,
        preload: path.join(__dirname, "preloadMain.js"),
        disableHtmlFullscreenWindowResize: true,
      },
    });
    const { width, height } = this.win.getBounds();

    this.win.contentView.addChildView(view);
    view.webContents.loadFile("index.html");
    process.env.APP_DEV && view.webContents.openDevTools();
    view.setBounds({ x: 0, y: this.heightTabs, width: width - 16, height });

    this.win.on("resize", () => {
      const { width, height } = this.win.getBounds();
      view.setBounds({ x: 0, y: this.heightTabs, width: width - 16, height });
    });

    return view;
  }

  setVisibleViewContent(id) {
    this.win.contentView.children.forEach((v) => {
      if (this.tabs.webContents.id !== v.webContents.id) {
        v.setVisible(v.webContents.id === id);
      }
    });
  }

  closeViewContent(id) {
    const view = this.win.contentView.children.find(
      (v) => v.webContents.id === id
    );
    this.win.contentView.removeChildView(view);
    view.webContents.destroy();

    if (this.win.contentView.children.length === 1) {
      this.win.destroy();
      this.app.quit();
    }
  }

  onDestroy(view, fn) {
    view.webContents.once("render-process-gone", fn);
    view.webContents.once("destroyed", fn);
  }
}

module.exports = { Messager, WakeUp, TabsViewContent };
