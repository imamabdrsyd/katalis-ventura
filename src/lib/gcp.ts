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
export const gcpSql =
  globalForGcp.gcpSql ??
  postgres(connectionString || 'postgres://localhost:5432/dummy', {
    max: 10, // Max number of connections in the pool
    idle_timeout: 20, // Idle connection timeout in seconds
    connect_timeout: 10, // Connect timeout in seconds
  });

if (process.env.NODE_ENV !== 'production') {
  globalForGcp.gcpSql = gcpSql;
}

export default gcpSql;
