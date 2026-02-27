# Claude Code Instructions

## Security

- **Jangan pernah membaca file `.env*`** (`.env`, `.env.local`, `.env.production`, dll)
- Jika perlu tahu nama environment variable, cukup lihat dari kode yang menggunakannya (misal `process.env.SUPABASE_URL`)
- Jangan tampilkan nilai secret keys, API keys, atau credentials apapun di output

## Stack

- **Framework**: Next.js App Router (bukan Pages Router)
- **Auth & Database**: Supabase (`@supabase/ssr` v0.8+, `@supabase/supabase-js` v2)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Deployment**: Vercel (auto-deploy dari branch `main`)

## Konvensi Supabase

- **Client-side** (komponen `'use client'`): gunakan `createClient()` dari `@/lib/supabase`
  ```ts
  import { createClient } from '@/lib/supabase';
  const supabase = createClient();
  ```
- **Server-side** (Route Handler, Server Component): gunakan `createServerClient()` dari `@/lib/supabase-server`
  ```ts
  import { createServerClient } from '@/lib/supabase-server';
  const supabase = await createServerClient();
  ```
- **Admin/bypass RLS**: gunakan `createAdminClient()` dari `@/lib/supabase-server` — hanya bila benar-benar perlu
- **Jangan pernah** import dari `@supabase/auth-helpers-nextjs` — sudah dihapus, pakai `@supabase/ssr`
- Selalu gunakan `supabase.auth.getUser()` bukan `getSession()` untuk verifikasi auth

## Struktur Route

```
app/
  (auth)/         — halaman login, signup, select-role (layout tanpa sidebar)
  (dashboard)/    — halaman utama dengan sidebar & BusinessProvider
  setup-business/ — onboarding setup bisnis (di luar layout dashboard)
  join-business/  — onboarding join bisnis (di luar layout dashboard)
  auth/callback/  — OAuth callback handler
  api/            — Route Handlers
```

## Auth Flow

1. **Email/Password**: login → dashboard
2. **Google OAuth**: login → `/auth/callback` → `/select-role` (jika user baru) → `/setup-business` atau `/join-business` → dashboard
3. User baru = belum ada record di `user_business_roles`
4. Role disimpan di `user_business_roles.role` dan `profiles.default_role`

## Konvensi Kode

- Commit message dalam **Bahasa Indonesia**
- Komponen page selalu `'use client'` — tidak ada server component di halaman
- Auth check di halaman: gunakan `useEffect` + `supabase.auth.getUser()` lalu redirect jika tidak login
- Setelah `router.push('/dashboard')` selalu tambahkan `router.refresh()` agar middleware me-refresh session
- Tipe data bisnis ada di `src/types/index.ts`
- API helper functions ada di `src/lib/api/`

## Middleware

- `middleware.ts` di root wajib ada — me-refresh session cookies `@supabase/ssr` di setiap request
- Jangan hapus atau modifikasi `supabase.auth.getUser()` di middleware
