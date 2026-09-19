// Khata Enterprise Crash Telemetry & Error Monitor Service
class CrashReporter {
  constructor() {
    this.logs = [];
    this.init();
  }

  init() {
    window.addEventListener('error', (event) => {
      this.captureException(event.error || new Error(event.message), {
        source: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.captureException(event.reason || new Error('Unhandled Promise Rejection'), {
        source: 'Promise'
      });
    });
  }

  captureException(error, context = {}) {
    const errorPayload = {
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack || null,
      context,
      userRole: localStorage.getItem('khata_user_profile') ? JSON.parse(localStorage.getItem('khata_user_profile')).role : 'UNKNOWN'
    };

    console.error('⚡ [CrashReporter Caught Error]:', errorPayload);
    this.logs.unshift(errorPayload);
    if (this.logs.length > 50) this.logs.pop();

    try {
      const existing = localStorage.getItem('khata_crash_telemetry');
      const list = existing ? JSON.parse(existing) : [];
      list.unshift(errorPayload);
      localStorage.setItem('khata_crash_telemetry', JSON.stringify(list.slice(0, 30)));
    } catch (e) {
      console.warn('Failed to cache crash log:', e);
    }
  }

  getLogs() {
    try {
      const existing = localStorage.getItem('khata_crash_telemetry');
      return existing ? JSON.parse(existing) : this.logs;
    } catch (e) {
      return this.logs;
    }
  }

  clearLogs() {
    this.logs = [];
    localStorage.removeItem('khata_crash_telemetry');
  }
}

export const crashReporter = new CrashReporter();
