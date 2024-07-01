class View {
  constructor() {
    this.form = document.querySelector('form');
    this.startBtn = document.querySelector('button#start');
    this.stopBtn = document.querySelector('button#stop');
    this.saveConfig = document.querySelector('button#clear');
    const config = localStorage.getItem('config');

    if (config) {
        Object.entries(JSON.parse(config) || {}).forEach(([key, value]) => {
        if (key && this.form.elements[key]) this.form.elements[key].value = value
      })
    } else {
      this.saveConfig.textContent = 'Запомнить настройки'
    }

    // старт программы
    this.form.addEventListener('submit', (ev) => this.handleStartTimers(ev));
    // стоп программы
    this.stopBtn.addEventListener('click', (ev) => this.handleStopTimers(ev));
    // очистить запомненные настройки
    this.saveConfig.addEventListener('click', (ev) => this.handleSaveConfig(ev));
    // создать задачу
    document.querySelector('button#createTask').addEventListener('click', async (ev) => this.handleCreateTask(ev));
    // удалить задачу
    document.querySelector('button#deleteTask').addEventListener('click', async (ev) => this.handleDeleteTask(ev));

    window.api.receive('info_log', (params) => this.addLog(params));
    window.api.receive('Messager_log/add', ({ text, isEnd }) => this.msgAddLog(text, isEnd));

    window.api.send('version').then((v) =>  document.querySelector('.version').textContent = `v${v}`);
  }

  handleStartTimers(ev) {
    ev.preventDefault();
    const formData = new FormData(ev.target);
    const formProps = Object.fromEntries(formData);

    window.api.send( 'Messager_start', formProps);

    for (const element of this.form.querySelectorAll('input, textarea')) element.disabled = true;
    this.startBtn.disabled = true;
    this.stopBtn.disabled = false;
  }

  handleStopTimers() {
    window.api.send( 'Messager_stop');
    for (const element of this.form.querySelectorAll('input, textarea')) element.disabled = false;
    this.startBtn.disabled = false;
    this.stopBtn.disabled = true;

    document.querySelector('.notification-log').innerHTML = '';
  }

  async handleCreateTask() {
    try {
      if (this.form.elements.startDay.value && !await window.api.send( 'WakeUp_isTaskCreated')) {
        window.api.send( 'WakeUp_createTask', this.form.elements.startDay.value);
      }
    } catch (err) {
    }
  }

  async handleDeleteTask() {
    try {
      if (await window.api.send( 'WakeUp_isTaskCreated')) {
        window.api.send( 'WakeUp_deleteTask');
      }
    } catch (err) {
    }
  }

  addLog({text, isError}) {
    const log = document.querySelector('.log');
    const logDiv = document.createElement('div');
    logDiv.className = isError ? 'error' : 'success';
    logDiv.textContent = text;

    log.appendChild(logDiv);
  }

  handleSaveConfig(ev) {
    const config = localStorage.getItem('config');

    if(config) {
      localStorage.removeItem('config');
      ev.target.textContent = 'Запомнить настройки';
    } else {
      const formData = new FormData(this.form);
      const formProps = Object.fromEntries(formData);

      localStorage.setItem('config', JSON.stringify(formProps));
      ev.target.textContent = 'Очистить запомненные настройки';
    }
  }

  msgAddLog(text, isEnd) {
    const log = document.querySelector('.notification-log');
    const logDiv = document.createElement('div');

    logDiv.className = isEnd ? 'endDay' : 'startDay';
    logDiv.textContent = text;

    isEnd ? log.querySelector('.endDay')?.remove() : log.querySelector('.startDay')?.remove();

    log.appendChild(logDiv);
  }
}

window.onload = () => {
  new View();
}



