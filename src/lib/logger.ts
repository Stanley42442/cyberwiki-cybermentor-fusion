// src/lib/logger.ts
// Structured logger — captures network, console, and JS errors automatically.
// Safe against: Vite HMR double-install, console.warn recursion, startup crashes.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'network';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  module: string;
  msg: string;
  data?: Record<string, unknown>;
}

const MAX_ENTRIES = 1000;
const STORAGE_KEY = 'cyberwiki-logs';
const isBrowser = typeof window !== 'undefined';
const IS_DEV = isBrowser && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

// These are the real originals, captured once before anything patches them.
// Stored at module scope so HMR reloads don't re-capture patched versions.
const _origWarn  = isBrowser ? console.warn.bind(console)  : () => {};
const _origError = isBrowser ? console.error.bind(console) : () => {};
const _origLog   = isBrowser ? console.log.bind(console)   : () => {};

class Logger {
  private buffer: LogEntry[] = [];
  private writing = false; // recursion guard

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) this.buffer = (JSON.parse(saved) as LogEntry[]).slice(-MAX_ENTRIES);
    } catch { /**/ }

    if (isBrowser) setTimeout(() => this.installInterceptors(), 100);
  }

  // ── Core write — never throws, never recurses ─────────────
  private write(level: LogLevel, module: string, msg: string, data?: Record<string, unknown>) {
    if (this.writing) return; // prevent recursion
    this.writing = true;
    try {
      const entry: LogEntry = { ts: new Date().toISOString(), level, module, msg, data };
      this.buffer.push(entry);
      if (this.buffer.length > MAX_ENTRIES) this.buffer.shift();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buffer)); } catch { /**/ }

      if (IS_DEV || level === 'error' || level === 'warn') {
        const prefix = `[${entry.ts.slice(11, 23)}] [${level.toUpperCase().padEnd(7)}] [${module}]`;
        if (level === 'error') _origError(prefix, msg, data ?? '');
        else if (level === 'warn') _origWarn(prefix, msg, data ?? '');
        else if (IS_DEV) _origLog(prefix, msg, data ?? '');
      }
    } finally {
      this.writing = false;
    }
  }

  // ── Public API ────────────────────────────────────────────
  debug = (m: string, msg: string, d?: Record<string, unknown>) => this.write('debug', m, msg, d);
  info  = (m: string, msg: string, d?: Record<string, unknown>) => this.write('info',  m, msg, d);
  warn  = (m: string, msg: string, d?: Record<string, unknown>) => this.write('warn',  m, msg, d);
  error = (m: string, msg: string, d?: Record<string, unknown>) => this.write('error', m, msg, d);

  // ── Interceptors ──────────────────────────────────────────
  private installInterceptors() {
    // Use a window-level flag so Vite HMR reloads don't install twice
    const w = window as unknown as Record<string, unknown>;
    if (w.__loggerInstalled) return;
    w.__loggerInstalled = true;

    // 1. fetch()
    try {
      const origFetch = window.fetch.bind(window);
      const self = this;
      window.fetch = async function(...args: Parameters<typeof fetch>) {
        const input = args[0];
        const init  = args[1];
        const rawUrl = typeof input === 'string' ? input
          : input instanceof URL ? input.href
          : (input as Request).url ?? '?';
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const start = Date.now();

        let safeUrl = rawUrl;
        try {
          const u = new URL(rawUrl, window.location.href);
          ['key','apikey','api_key','access_token'].forEach(k => u.searchParams.delete(k));
          safeUrl = u.toString();
        } catch { /**/ }

        try {
          const res = await origFetch(...args);
          self.write(res.ok ? 'network' : 'error', 'network',
            `${method} ${res.status} ${safeUrl}`,
            { status: res.status, ok: res.ok, ms: Date.now() - start });
          return res;
        } catch (e) {
          self.write('error', 'network', `${method} FAILED ${safeUrl}`,
            { error: String(e), ms: Date.now() - start });
          throw e;
        }
      };
    } catch { /**/ }

    // 2. console.error — use _origError so we never recurse
    try {
      const self = this;
      console.error = (...args: unknown[]) => {
        if (!self.writing) {
          const msg = args.map(a => a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          self.write('error', 'console', msg.slice(0, 600));
        }
        _origError(...args);
      };
    } catch { /**/ }

    // 3. console.warn — skip React Router noise & our own output
    try {
      const self = this;
      const skipPhrases = ['React Router Future Flag', 'v7_startTransition', 'v7_relativeSplatPath', 'No sources are declared'];
      console.warn = (...args: unknown[]) => {
        if (!self.writing) {
          const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          const isNoise = skipPhrases.some(p => msg.includes(p));
          if (!isNoise) self.write('warn', 'console', msg.slice(0, 600));
        }
        _origWarn(...args);
      };
    } catch { /**/ }

    // 4. Uncaught JS errors
    try {
      window.addEventListener('error', (e) => {
        this.write('error', 'window', e.message ?? 'Unknown JS error', {
          file: e.filename, line: e.lineno, col: e.colno,
          stack: e.error?.stack?.slice(0, 400),
        });
      });
    } catch { /**/ }

    // 5. Unhandled promise rejections
    try {
      window.addEventListener('unhandledrejection', (e) => {
        this.write('error', 'promise', String(e.reason?.message ?? e.reason ?? 'Unhandled rejection'), {
          stack: e.reason?.stack?.slice(0, 400),
        });
      });
    } catch { /**/ }
  }

  // ── Export / Download ─────────────────────────────────────
  export(): string {
    return this.buffer.map(e => {
      const d = e.data ? ' ' + JSON.stringify(e.data) : '';
      return `${e.ts} [${e.level.toUpperCase().padEnd(7)}] [${e.module}] ${e.msg}${d}`;
    }).join('\n');
  }

  download() {
    try {
      const header = [
        '=== CyberWiki × CyberMentor Diagnostic Log ===',
        'Generated: ' + new Date().toISOString(),
        'Entries: ' + this.buffer.length + ' | Errors: ' + this.errorCount,
        'UA: ' + navigator.userAgent,
        '='.repeat(60), '',
      ].join('\n');
      const blob = new Blob([header + this.export()], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: 'cyberwiki-log-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.txt',
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch { /**/ }
  }

  clear() {
    this.buffer = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch { /**/ }
    // Reset install flag so interceptors can be reinstalled after clear
    try { delete (window as unknown as Record<string, unknown>).__loggerInstalled; } catch { /**/ }
  }

  get entries() { return [...this.buffer]; }
  get errorCount() { return this.buffer.filter(e => e.level === 'error').length; }
}

export const log = new Logger();
if (IS_DEV) {
  try { (window as unknown as Record<string, unknown>).__log = log; } catch { /**/ }
}
