import postgres from 'postgres';

// Ensure we only create a single instance of the database client in development
// to avoid exhausting connections on hot-reloads.
const connectionString = process.env.GCP_ANALYTICS_DB_URL;

if (!connectionString) {
  // Hanya lemparkan error jika kita sedang menjalankan kode di server dan variabel belum di-set
  if (typeof window === 'undefined') {
    console.warn('⚠️ Peringatan: GCP_ANALYTICS_DB_URL belum dikonfigurasi di .env.local');
  }
}

const globalForGcp = globalThis as unknown as {
  gcpSql: postgres.Sql | undefined;
};

// Create a singleton postgres client
const rawSql =
  globalForGcp.gcpSql ??
  postgres(connectionString || 'postgres://localhost:5432/dummy', {
    max: 10, // Max number of connections in the pool
    idle_timeout: 20, // Idle connection timeout in seconds
    // 3 detik, bukan 10: saat instance Cloud SQL mati, IP publiknya jadi black hole
    // (paket didrop diam-diam tanpa RST) sehingga koneksi menggantung sampai timeout.
    // Tiap detik di sini terpotong langsung dari anggaran 60s serverless AXION Agent.
    connect_timeout: 3,
    ssl: connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1') ? 'require' : false,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForGcp.gcpSql = rawSql;
}

// ─── Circuit breaker ──────────────────────────────────────────────────────────
// Instance Cloud SQL `axion-agents` bisa dimatikan untuk menekan biaya (lihat
// docs). Saat mati, tiap query membakar `connect_timeout` detik sebelum gagal.
// Loop AXION Agent (MAX_TOOL_ITERATIONS=6 dalam maxDuration 60s) bisa memanggil
// tool ber-GCP beberapa kali dalam satu percakapan, jadi tanpa breaker anggaran
// waktunya habis untuk menunggu socket mati dan user tidak dapat jawaban sama
// sekali — bukan sekadar kehilangan satu fitur.
//
// Sekali gagal konek, tandai unavailable selama OPEN_MS dan gagalkan instan.
// Pulih otomatis saat instance dinyalakan lagi (tidak butuh env flag / redeploy).

const OPEN_MS = 60_000;

const breaker = globalThis as unknown as { gcpUnavailableUntil?: number };

/** Error koneksi (bukan error SQL) — hanya ini yang boleh membuka breaker. */
function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return (
    code === 'CONNECT_TIMEOUT' ||
    code === 'CONNECTION_REFUSED' ||
    code === 'CONNECTION_CLOSED' ||
    code === 'CONNECTION_DESTROYED' ||
    code === 'CONNECTION_ENDED' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    code === 'ENOTFOUND'
  );
}

/** Lempar segera bila breaker sedang terbuka, tanpa menyentuh jaringan. */
function assertAvailable(): void {
  const until = breaker.gcpUnavailableUntil ?? 0;
  if (Date.now() < until) {
    throw new Error(
      'Database analitik (GCP Cloud SQL) sedang tidak dapat dihubungi — instance kemungkinan ' +
        'sedang dimatikan. Gunakan tool yang membaca data live (get_financial_summary / ' +
        'query_transactions) sebagai gantinya.',
    );
  }
}

/** Catat hasil query untuk membuka/menutup breaker. */
function track<T>(result: PromiseLike<T>): Promise<T> {
  return Promise.resolve(result).then(
    (value) => {
      breaker.gcpUnavailableUntil = 0;
      return value;
    },
    (err: unknown) => {
      if (isConnectionError(err)) {
        breaker.gcpUnavailableUntil = Date.now() + OPEN_MS;
        console.warn(
          `[gcp] Koneksi gagal, circuit breaker dibuka ${OPEN_MS / 1000}s:`,
          err instanceof Error ? err.message : err,
        );
      }
      throw err;
    },
  );
}

// Proxy menjaga call site tetap idiomatis (gcpSql`...`, .unsafe, .begin) tanpa
// perlu mengubah ~27 pemanggil. Catatan: query di-await sebagai Promise, jadi
// API streaming postgres.js (.cursor/.forEach) tidak diteruskan — tidak dipakai
// di codebase ini.
export const gcpSql = new Proxy(rawSql, {
  apply(target, thisArg, args: unknown[]) {
    assertAvailable();
    return track(Reflect.apply(target as never, thisArg, args) as PromiseLike<unknown>);
  },
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (prop === 'unsafe' || prop === 'begin' || prop === 'file') {
      return (...args: unknown[]) => {
        assertAvailable();
        return track((value as (...a: unknown[]) => PromiseLike<unknown>).apply(target, args));
      };
    }
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  },
}) as postgres.Sql;

export default gcpSql;
