import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
  Platform,
} from 'react-native';
import {
  BufferHelper,
  getPrinterSeriesByName,
  requestAndroidPermissions,
  enableLocationAccessAndroid10,
} from './utils';
import type {
  PrinerEvents,
  EventListenerCallback,
  IDiscoverParams,
  IPrinter,
  IPrinterInitParams,
  PrinterSeriesName,
  IMonitorStatus,
} from './types';
import {
  PRINTER_SERIES,
  FONT_A_CHARS_PER_LINE,
  DEFAULT_FONT_A_CHARS_PER_LINE,
  DEFAULT_PAPER_WIDTHT,
} from './constants';

const { EscPosPrinter, EscPosPrinterDiscovery } = NativeModules;

const discoveryEventEmmiter = new NativeEventEmitter(EscPosPrinterDiscovery);
const printEventEmmiter = new NativeEventEmitter(EscPosPrinter);
import printing from './printing';

const _default = {
  init({ target, seriesName }: IPrinterInitParams): Promise<number> {
    const series = PRINTER_SERIES[seriesName];
    return EscPosPrinter.init(target, series);
  },
  async discover(params?: IDiscoverParams): Promise<IPrinter[]> {
    if (
      Platform.OS === 'ios' ||
      ((await requestAndroidPermissions()) &&
        (await enableLocationAccessAndroid10()))
    ) {
      return new Promise((res, rej) => {
        let listener: EmitterSubscription | null;
        function removeListener() {
          listener?.remove();
          listener = null;
        }
        listener = discoveryEventEmmiter.addListener(
          'onDiscoveryDone',
          (printers: IPrinter[]) => {
            res(printers);
            removeListener();
          }
        );
        let promise;
        if (Platform.OS === 'ios') {
          promise = EscPosPrinterDiscovery.discover();
        } else {
          promise = EscPosPrinterDiscovery.discover(params);
        }

        promise
          .then(() => {
            removeListener();
            res([]);
          })
          .catch((e: Error) => {
            removeListener();
            rej(e);
          });
      });
    }

    return Promise.reject('No permissions granted');
  },
  printRawData(uint8Array: Uint8Array): Promise<IMonitorStatus> {
    const buffer = new BufferHelper();
    const base64String = buffer.bytesToString(uint8Array, 'base64');

    let successListener: EmitterSubscription | null;
    let errorListener: EmitterSubscription | null;

    function removeListeners() {
      successListener?.remove();
      errorListener?.remove();

      successListener = null;
      errorListener = null;
    }

    return new Promise((res, rej) => {
      successListener = printEventEmmiter.addListener(
        'onPrintSuccess',
        (status) => {
          removeListeners();
          res(status);
        }
      );

      errorListener = printEventEmmiter.addListener(
        'onPrintFailure',
        (status) => {
          removeListeners();
          rej(status);
        }
      );

      EscPosPrinter.printBase64(base64String).catch((e: Error) => {
        removeListeners();
        rej(e);
      });
    });
  },

  getPaperWidth(): Promise<80 | 60 | 58> {
    let successListener: EmitterSubscription | null;
    let errorListener: EmitterSubscription | null;

    function removeListeners() {
      successListener?.remove();
      errorListener?.remove();

      successListener = null;
      errorListener = null;
    }

    return new Promise((res, rej) => {
      successListener = printEventEmmiter.addListener(
        'onGetPaperWidthSuccess',
        (status) => {
          removeListeners();
          res(status);
        }
      );

      errorListener = printEventEmmiter.addListener(
        'onGetPaperWidthFailure',
        (status) => {
          removeListeners();
          rej(status);
        }
      );

      EscPosPrinter.getPaperWidth().catch((e: Error) => {
        removeListeners();
        rej(e);
      });
    });
  },

  async getPrinterCharsPerLine(
    seriesName: PrinterSeriesName
  ): Promise<{ fontA: number }> {
    const paperWidth: 80 | 60 | 58 =
      (await this.getPaperWidth()) || DEFAULT_PAPER_WIDTHT;

    const key = String(paperWidth) as '80' | '60' | '58';

    const seriesCharsPerLineFontA = FONT_A_CHARS_PER_LINE[seriesName];
    const fontAcplForCurrentWidth = seriesCharsPerLineFontA?.[key];

    return {
      fontA:
        fontAcplForCurrentWidth || DEFAULT_FONT_A_CHARS_PER_LINE[paperWidth],
    };
  },

  pairingBluetoothPrinter(): Promise<string> {
    if (Platform.OS === 'ios') {
      return EscPosPrinter.pairingBluetoothPrinter();
    }
    return Promise.resolve('Successs');
  },

  disconnect() {
    EscPosPrinter.disconnect();
  },

  startMonitorPrinter(interval: number = 5) {
    return EscPosPrinter.startMonitorPrinter(Math.max(5, Math.floor(interval)));
  },

  stopMonitorPrinter() {
    return EscPosPrinter.stopMonitorPrinter();
  },

  addPrinterStatusListener(listener: (status: IMonitorStatus) => void) {
    const statusListener = printEventEmmiter.addListener(
      'onMonitorStatusUpdate',
      listener
    );

    return () => {
      statusListener.remove();
    };
  },
  printing,
};

export { getPrinterSeriesByName, PRINTER_SERIES };
export type {
  PrinerEvents,
  EventListenerCallback,
  IPrinter,
  PrinterSeriesName,
};

export default _default;
