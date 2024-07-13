const {Messager, Vpn} = require("../services");

const config = {
  start_body: '',
  end_body: '',
  startDay: '09:00',
  endDay: '18:00',
  email: 'test@test.com',
  password: 'test',
  vpnUser: 'test',
  vpnPassword: 'test',
  to: 'test@test.com',
}

jest.mock("ews-javascript-api", () => {
  const originalModule = jest.requireActual("ews-javascript-api");

  class EmailMessageExt extends originalModule.EmailMessage {
    constructor(service) {
      super(service);
    }

    SendAndSaveCopy = () => {
      return Promise.resolve();
    }

    Send = () => {
      return Promise.resolve();
    }
  }

  return {...originalModule, EmailMessage: EmailMessageExt};
}, {virtual: true});

describe('Тест планировщика отправки', () => {

  const view = {
    webContents: {
      send: jest.fn((event, {text}) => text)
    }
  }

  const messagerService = new Messager(view);
  const vpnService = new Vpn(view);
  vpnService.connect = () => Promise.resolve(true);
  messagerService.vpnService = vpnService;

  const fakeTimer = jest.useFakeTimers();

  afterEach(() => {
    view.webContents.send.mockClear();
    vpnService.stop();
    fakeTimer.clearAllTimers();
  });

  test('Запуск программы до 9:00, ПН/ВТ/CР', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-01 08:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 01.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 01.07.24 18:00");

    await jest.advanceTimersByTimeAsync(5 * 60000);

    expect(view.webContents.send.mock.calls[2][1].text).toBe("01.July.2024 09:00 [Начало дня] - Успех");
    expect(view.webContents.send.mock.calls[3][1].text).toBe("Запланирована отправка 02.07.24 09:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(4);
  });

  test('Запуск программы в 9:00, ПН/ВТ/CР', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-01 09:00'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 02.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 01.07.24 18:00");

    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Запуск программы до 18:00, ПН/ВТ/CР', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-01 17:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 02.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 01.07.24 18:00");

    await jest.advanceTimersByTimeAsync(5 * 60000);

    expect(view.webContents.send.mock.calls[2][1].text).toBe("01.July.2024 18:00 [Конец дня] - Успех");
    expect(view.webContents.send.mock.calls[3][1].text).toBe("Запланирована отправка 02.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(4);
  });

  test('Запуск программы в 18:00, ПН/ВТ/CР', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-01 18:00'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 02.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 02.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Запуск программы до 18:00, ПН/ВТ/CР', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-01 17:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 02.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 01.07.24 18:00");

    await jest.advanceTimersByTimeAsync(5 * 60000);

    expect(view.webContents.send.mock.calls[2][1].text).toBe("01.July.2024 18:00 [Конец дня] - Успех");
    expect(view.webContents.send.mock.calls[3][1].text).toBe("Запланирована отправка 02.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(4);
  });

  test('Запуск программы после 18:00, ПН/ВТ/CР', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-01 18:05'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 02.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 02.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Запуск программы до 9:00, Четверг', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-04 08:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 04.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 04.07.24 18:00");

    await jest.advanceTimersByTimeAsync(5 * 60000);

    expect(view.webContents.send.mock.calls[2][1].text).toBe("04.July.2024 09:00 [Начало дня] - Успех");
    expect(view.webContents.send.mock.calls[3][1].text).toBe("Запланирована отправка 05.07.24 09:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(4);
  });

  test('Запуск программы в 9:00, Четверг', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-04 09:00'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 05.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 04.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Запуск программы до 18:00, Четверг', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-04 17:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 05.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 04.07.24 18:00");

    await jest.advanceTimersByTimeAsync(5 * 60000);

    expect(view.webContents.send.mock.calls[2][1].text).toBe("04.July.2024 18:00 [Конец дня] - Успех");
    expect(view.webContents.send.mock.calls[3][1].text).toBe("Запланирована отправка 05.07.24 16:45");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(4);
  });


  test('Запуск программы в 18:00, Четверг', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-04 18:00'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 05.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 05.07.24 16:45");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Запуск программы после 18:00, Четверг', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-04 18:05'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 05.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 05.07.24 16:45");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Запуск программы до 09:00, Пятница', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-05 08:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 05.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 05.07.24 16:45");

    await jest.advanceTimersByTimeAsync(5 * 60000);

    expect(view.webContents.send.mock.calls[2][1].text).toBe("05.July.2024 09:00 [Начало дня] - Успех");
    expect(view.webContents.send.mock.calls[3][1].text).toBe("Запланирована отправка 08.07.24 09:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(4);
  });

  test('Запуск программы в 09:00, Пятница', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-05 09:00'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 08.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 05.07.24 16:45");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Запуск программы до 16:45, Пятница', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-05 16:40'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 08.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 05.07.24 16:45");

    await jest.advanceTimersByTimeAsync(5 * 60000);

    expect(view.webContents.send.mock.calls[2][1].text).toBe("05.July.2024 16:45 [Конец дня] - Успех");
    expect(view.webContents.send.mock.calls[3][1].text).toBe("Запланирована отправка 08.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(4);
  });

  test('Запуск программы в 16:45, Пятница', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-05 16:45'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 08.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 08.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });


  test('Запуск программы после 16:45, Пятница', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-05 16:50'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 08.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 08.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Запуск программы в субботу', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-06 11:50'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 08.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 08.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Запуск программы в воскресенье', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-07 11:50'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 08.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 08.07.24 18:00");

    // проверяем спам
    expect(view.webContents.send.mock.calls.length).toEqual(2);
  });

  test('Полный цикл планирования. с пн. по вс. не выключая программу', async () => {
    // понедельник
    fakeTimer.setSystemTime(new Date('2024-07-01 08:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 01.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 01.07.24 18:00");

    await jest.advanceTimersByTimeAsync(5 * 60000);
    expect(view.webContents.send.mock.calls[2][1].text).toBe("01.July.2024 09:00 [Начало дня] - Успех");
    expect(view.webContents.send.mock.calls[3][1].text).toBe("Запланирована отправка 02.07.24 09:00");
    expect(view.webContents.send.mock.calls.length).toEqual(4);
    await jest.advanceTimersByTimeAsync(9 * 60000 * 60);
    expect(view.webContents.send.mock.calls[4][1].text).toBe("01.July.2024 18:00 [Конец дня] - Успех");
    expect(view.webContents.send.mock.calls[5][1].text).toBe("Запланирована отправка 02.07.24 18:00");
    expect(view.webContents.send.mock.calls.length).toEqual(6);

    // вторник
    await jest.advanceTimersByTimeAsync(15 * 60000 * 60);
    expect(view.webContents.send.mock.calls[6][1].text).toBe("02.July.2024 09:00 [Начало дня] - Успех");
    expect(view.webContents.send.mock.calls[7][1].text).toBe("Запланирована отправка 03.07.24 09:00");
    expect(view.webContents.send.mock.calls.length).toEqual(8);
    await jest.advanceTimersByTimeAsync(9 * 60000 * 60);
    expect(view.webContents.send.mock.calls[8][1].text).toBe("02.July.2024 18:00 [Конец дня] - Успех");
    expect(view.webContents.send.mock.calls[9][1].text).toBe("Запланирована отправка 03.07.24 18:00");
    expect(view.webContents.send.mock.calls.length).toEqual(10);

    // среда
    await jest.advanceTimersByTimeAsync(15 * 60000 * 60);
    expect(view.webContents.send.mock.calls[10][1].text).toBe("03.July.2024 09:00 [Начало дня] - Успех");
    expect(view.webContents.send.mock.calls[11][1].text).toBe("Запланирована отправка 04.07.24 09:00");
    expect(view.webContents.send.mock.calls.length).toEqual(12);
    await jest.advanceTimersByTimeAsync(9 * 60000 * 60);
    expect(view.webContents.send.mock.calls[12][1].text).toBe("03.July.2024 18:00 [Конец дня] - Успех");
    expect(view.webContents.send.mock.calls[13][1].text).toBe("Запланирована отправка 04.07.24 18:00");
    expect(view.webContents.send.mock.calls.length).toEqual(14);

    // четверг
    await jest.advanceTimersByTimeAsync(15 * 60000 * 60);
    expect(view.webContents.send.mock.calls[14][1].text).toBe("04.July.2024 09:00 [Начало дня] - Успех");
    expect(view.webContents.send.mock.calls[15][1].text).toBe("Запланирована отправка 05.07.24 09:00");
    expect(view.webContents.send.mock.calls.length).toEqual(16);
    await jest.advanceTimersByTimeAsync(9 * 60000 * 60);
    expect(view.webContents.send.mock.calls[16][1].text).toBe("04.July.2024 18:00 [Конец дня] - Успех");
    expect(view.webContents.send.mock.calls[17][1].text).toBe("Запланирована отправка 05.07.24 16:45");
    expect(view.webContents.send.mock.calls.length).toEqual(18);

    // пятница
    await jest.advanceTimersByTimeAsync(15 * 60000 * 60);
    expect(view.webContents.send.mock.calls[18][1].text).toBe("05.July.2024 09:00 [Начало дня] - Успех");
    expect(view.webContents.send.mock.calls[19][1].text).toBe("Запланирована отправка 08.07.24 09:00");
    expect(view.webContents.send.mock.calls.length).toEqual(20);
    await jest.advanceTimersByTimeAsync(9 * 60000 * 60);
    expect(view.webContents.send.mock.calls[20][1].text).toBe("05.July.2024 16:45 [Конец дня] - Успех");
    expect(view.webContents.send.mock.calls[21][1].text).toBe("Запланирована отправка 08.07.24 18:00");
    expect(view.webContents.send.mock.calls.length).toEqual(22);

    // суббота
    await jest.advanceTimersByTimeAsync(15 * 60000 * 60);
    expect(view.webContents.send.mock.calls.length).toEqual(22);

    // воскресенье
    await jest.advanceTimersByTimeAsync(15 * 60000 * 60);
    expect(view.webContents.send.mock.calls.length).toEqual(22);
  });
});

describe('Обработка ошибок', () => {
  const view = {
    webContents: {
      send: jest.fn((event, {text}) => text)
    }
  }

  const messagerService = new Messager(view);
  const vpnService = new Vpn(view);
  vpnService.connect = jest.fn(() => Promise.resolve(false));
  messagerService.vpnService = vpnService;

  const fakeTimer = jest.useFakeTimers();

  afterEach(() => {
    view.webContents.send.mockClear();
    vpnService.connect.mockClear();
    vpnService.stop();
    fakeTimer.clearAllTimers();
  });

  test('В случае ошибки (не подключился к впн например), после 12 попыток планируем на следующий день отпраку', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-01 08:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 01.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 01.07.24 18:00");
    await jest.advanceTimersByTimeAsync(5 * 60000);

    expect(vpnService.connect.mock.calls.length).toEqual(1);
    expect(view.webContents.send.mock.calls.length).toEqual(2);

    for (let i = 2; i < 14; i++) {
      await jest.advanceTimersByTimeAsync(2 * 60000);
      expect(vpnService.connect.mock.calls.length).toEqual(i);
    }

    expect(view.webContents.send.mock.calls.length).toEqual(3);
    expect(view.webContents.send.mock.calls[2][1].text).toBe("Запланирована отправка 02.07.24 09:00");
  });

  test('В случае ошибки (не подключился к впн например), после 12 попыток планируем на следующий день отпраку', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-01 08:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 01.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 01.07.24 18:00");
    await jest.advanceTimersByTimeAsync(5 * 60000);

    expect(vpnService.connect.mock.calls.length).toEqual(1);
    expect(view.webContents.send.mock.calls.length).toEqual(2);

    for (let i = 2; i < 14; i++) {
      await jest.advanceTimersByTimeAsync(2 * 60000);
      expect(vpnService.connect.mock.calls.length).toEqual(i);
    }

    expect(view.webContents.send.mock.calls.length).toEqual(3);
    expect(view.webContents.send.mock.calls[2][1].text).toBe("Запланирована отправка 02.07.24 09:00");
  });

  test('В случае ошибки (не подключился к впн например), после 2 попытки ошибка исчезает', async () => {
    fakeTimer.setSystemTime(new Date('2024-07-01 08:55'));
    messagerService.start(config);

    expect(view.webContents.send.mock.calls[0][1].text).toBe("Запланирована отправка 01.07.24 09:00");
    expect(view.webContents.send.mock.calls[1][1].text).toBe("Запланирована отправка 01.07.24 18:00");

    await jest.advanceTimersByTimeAsync(5 * 60000);
    expect(vpnService.connect.mock.calls.length).toEqual(1);
    expect(view.webContents.send.mock.calls.length).toEqual(2);
    vpnService.connect = jest.fn(() => Promise.resolve(true));
    await jest.advanceTimersByTimeAsync(2 * 60000);
    expect(vpnService.connect.mock.calls.length).toEqual(1);

    expect(view.webContents.send.mock.calls[2][1].text).toBe("01.July.2024 09:02 [Начало дня] - Успех");
    expect(view.webContents.send.mock.calls[3][1].text).toBe("Запланирована отправка 02.07.24 09:00");
    expect(view.webContents.send.mock.calls.length).toEqual(4);
  });
})
