# AXION Design System

> **Live document** — setiap perubahan pada token, komponen kanonik, atau pattern UI wajib update dokumen ini di sesi yang sama.
> Source of truth untuk semua keputusan visual di Katalis Ventura (branding: **AXION**).
>
> Terakhir diupdate: 18 April 2026

---

## 0. Product Identity

**AXION (Katalis Ventura)** — platform akuntansi dan pembukuan double-entry untuk UKM Indonesia.

- **Stack UI:** Next.js App Router + Tailwind CSS + TypeScript, dark/light mode via `next-themes` (class-based)
- **Bahasa UI:** Bahasa Indonesia (prioritas), English (fallback untuk istilah teknis)
- **Audience:** Pemilik UKM & investor — **bukan akuntan profesional**. UI harus terasa seperti aplikasi fintech modern, bukan software akuntansi enterprise
- **Nada visual:** Bersih, airy, ramah. Rounded-corners generous (xl/2xl), shadow ringan, transisi halus

---

## 1. Design Tokens

### 1.1 Warna Brand

Primary scale (indigo) — definisi di [tailwind.config.js](../tailwind.config.js):

```js
primary: {
  50:  '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',  // <-- primary default
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
}
```

**Aturan pakai:**
- `primary-500` untuk tombol utama, link aktif, fokus ring
- `primary-600` untuk hover state
- `primary-50/100` untuk background subtle (info banner, badge accent terang)
- `primary-400` di dark mode sebagai text/icon accent
- **Jangan** pakai indigo-* mentah dari Tailwind — selalu pakai `primary-*` supaya themeable

### 1.2 Warna Semantik

| Semantik | Light | Dark | Pakai untuk |
|----------|-------|------|-------------|
| Success | `emerald-500/600` | `emerald-400` | Pendapatan, kenaikan, koneksi aktif, saldo positif |
| Danger | `red-500/600` | `red-400` | Beban, delete, error, saldo minus |
| Warning | `amber-500/600` | `amber-400` | Peringatan, draft, data belum final |
| Info | `primary-500` | `primary-400` | Aksen netral, link, active state |
| Neutral | `gray-500/600` | `gray-400` | Teks sekunder, icon inactive |

### 1.3 Warna Kategori Transaksi

Badge wajib konsisten dengan utility class di [globals.css](../app/globals.css):

| Kategori | Utility | Color |
|----------|---------|-------|
| EARN | `.badge-earn` | emerald |
| OPEX | `.badge-opex` | red |
| VAR | `.badge-var` | amber |
| CAPEX | `.badge-capex` | indigo |
| TAX | `.badge-tax` | purple |
| FIN | `.badge-fin` | pink |

> Dulu di memory pernah ada versi "VAR=pink, FIN=indigo" — **sudah di-deprecate**. Selalu rujuk `globals.css` sebagai source of truth.

### 1.4 Warna Tipe Kontak

Disimpan di komponen ContactList & memory:

| Tipe | Color |
|------|-------|
| customer | emerald / green |
| vendor | blue |
| partner | indigo |
| staff | amber / orange |
| investor | indigo |
| other | gray |

### 1.5 Surface (Background)

| Token | Light | Dark |
|-------|-------|------|
| Page background | `bg-gray-50` | `dark:bg-gray-900` |
| Card surface | `bg-white` | `dark:bg-gray-800` |
| Card elevated / modal | `bg-white` | `dark:bg-gray-800` |
| Nested panel (info box) | `bg-gray-50` | `dark:bg-gray-800` *(lihat catatan)* |
| Input bg | `bg-white` | `dark:bg-gray-700` |
| Subtle button / chip | `bg-gray-100` | `dark:bg-gray-700` |
| Code inline | `bg-gray-200` | `dark:bg-gray-700` |

**Catatan nested surface:** di halaman (yang body-nya `gray-50`), nested panel pakai `bg-gray-50` — tapi di dalam card putih, nested panel harus kontras, pakai `bg-gray-100` atau `bg-gray-50` dengan border. Hindari "bg-gray-50 di atas bg-white" yang nyaris invisible.

### 1.6 Border

| Token | Light | Dark |
|-------|-------|------|
| Card border | `border-gray-100` | `dark:border-gray-700` |
| Divider | `border-gray-100` | `dark:border-gray-700` |
| Input border | `border-gray-200` | `dark:border-gray-600` |
| Input border (emphasized) | `border-gray-300` | `dark:border-gray-600` |

### 1.7 Radius

| Token | Pakai untuk |
|-------|-------------|
| `rounded` (4px) | Tag kecil, inline code |
| `rounded-lg` (8px) | Badge, tab item (child) |
| `rounded-xl` (12px) | Button, input, small card, tab container |
| `rounded-2xl` (16px) | Card utama, modal |
| `rounded-full` | Pill, avatar, segmented toggle, chip |

**Aturan nesting:** container selalu lebih besar radius-nya dari child. Contoh: segmented toggle `rounded-full` dengan button child `rounded-full` (keduanya full karena pill), atau tab container `rounded-xl` dengan button child `rounded-lg`.

### 1.8 Shadow

| Token | Pakai untuk |
|-------|-------------|
| `shadow-sm` | Card default, active toggle button |
| `shadow-md` | Card hover, dropdown |
| `shadow-2xl` | Modal |
| `shadow-none` | Flat panel, nested surface |

### 1.9 Typography

```
font-bold      18-24px  Heading utama (h2/h3) — warna gray-800 / dark:gray-100
font-semibold  14-16px  Label form, button, angka penting
font-medium    13-14px  Body emphasis, sub-label
font-normal    14px     Body default
```

**Text colors:**
- Primary text: `text-gray-800 dark:text-gray-100` (heading) / `text-gray-900 dark:text-gray-100` (body)
- Secondary text: `text-gray-600 dark:text-gray-300`
- Tertiary / muted: `text-gray-500 dark:text-gray-400`
- Disabled: tambah `opacity-50`

### 1.10 Spacing

Ikut skala Tailwind default. Padding kanonik per komponen:

| Komponen | Padding |
|----------|---------|
| Card | `p-6` |
| Modal header/footer | `px-5 py-4` |
| Button default | `px-4 py-2` |
| Button small | `px-3 py-1.5` |
| Input | `px-4 py-3` |
| Badge | `px-3 py-1` |
| Toggle container | `p-1` |

### 1.11 Transition

Default: `transition-colors` untuk perubahan warna, `transition-all` untuk kombinasi color + shadow + transform. Durasi default Tailwind (150ms). **Jangan** pakai animasi custom kecuali untuk modal (`animate-in fade-in zoom-in-95 duration-200`).

---

## 2. Utility Classes (`app/globals.css`)

Preferensikan utility class sebelum menulis classes Tailwind panjang. Yang tersedia:

| Class | Definisi singkat |
|-------|------------------|
| `.card` | Card default dengan hover lift |
| `.card-static` | Card tanpa hover (untuk dashboard/detail) |
| `.btn-primary` | Tombol utama indigo solid |
| `.btn-secondary` | Tombol sekunder abu solid |
| `.btn-outline` | Tombol border primary (aksi penting tapi bukan CTA utama, contoh: Quick Entry) |
| `.btn-ghost` | Tombol dengan border abu (secondary action, cancel, import) |
| `.btn-icon` | Tombol icon-only square, tidak ada teks |
| `.btn-danger` | Tombol destructive merah |
| `.input` | Input/select/textarea standar |
| `.label` | Label form standar |
| `.badge` + `.badge-{kategori}` | Badge kategori transaksi |

**Kalau butuh variant baru** (misal `.btn-ghost`, `.badge-status`) — tambahkan di `globals.css`, jangan inline.

---

## 3. Komponen Kanonik

### 3.1 Segmented Toggle (Binary / Pill)

**Pakai untuk:** switch 2-3 state yang mutually exclusive, nilai setara (Monthly/Yearly, Draft/Posted, Harian/Mingguan).

**Referensi kanonik:** [MonitoringChart.tsx:262-283](../src/components/charts/MonitoringChart.tsx#L262-L283)

**Anatomi:**
```tsx
<div className="inline-flex p-1 bg-gray-100 dark:bg-gray-700 rounded-full">
  <button
    onClick={() => setValue('a')}
    className={`px-4 py-1.5 text-sm rounded-full transition-all ${
      value === 'a'
        ? 'bg-white dark:bg-gray-600 text-indigo-500 dark:text-indigo-400 font-semibold shadow-sm'
        : 'bg-transparent text-gray-500 dark:text-gray-400 font-normal hover:text-gray-700 dark:hover:text-gray-200'
    }`}
  >
    Option A
  </button>
  {/* ...option B */}
</div>
```

**Spec:**
- Container: `rounded-full` + `bg-gray-100 dark:bg-gray-700` + `p-1`
- Child: `rounded-full` + `px-4 py-1.5` + `text-sm`
- Active: `bg-white dark:bg-gray-600` + `text-indigo-500 dark:text-indigo-400` + `font-semibold shadow-sm`
- Inactive: `bg-transparent` + `text-gray-500 dark:text-gray-400` + `font-normal` + hover warna naik 1 level
- Transition: `transition-all` (karena shadow ikut berubah)
- Icon (opsional): pakai size `w-3.5 h-3.5` dengan `gap-1.5`

**Jangan:**
- ❌ Active pakai fill solid (`bg-primary-500 text-white`) — itu Button pattern, bukan Toggle
- ❌ Pakai border di container — container transparan dengan soft bg saja
- ❌ Pakai `rounded-xl` untuk toggle binary — itu tab pattern

### 3.2 Tab Navigation (Multi-item)

**Pakai untuk:** navigasi antar view dalam halaman yang sama, jumlah tab 3+ (Overview/Input/Variance/Projection, Members/Contacts/Invites).

**Referensi kanonik:** [roi-forecast/page.tsx:170-192](../app/(dashboard)/roi-forecast/page.tsx#L170-L192), [businesses/[id]/members/page.tsx:220](../app/(dashboard)/businesses/%5Bid%5D/members/page.tsx#L220)

**Anatomi:**
```tsx
<div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
  <button
    onClick={() => setTab('overview')}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === 'overview'
        ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
    }`}
  >
    Overview
  </button>
</div>
```

**Spec:**
- Container: `rounded-xl` + `bg-gray-100 dark:bg-gray-800` + `p-1`
- Child: `rounded-lg` + `px-4 py-2` + `font-medium`
- Active: `bg-white dark:bg-gray-700` + `text-gray-800 dark:text-gray-100` + `shadow-sm` (NO color accent — tab lebih netral dari toggle)
- Overflow: wrap dengan `overflow-x-auto scrollbar-hide` di mobile

**Kapan pilih Tab vs Toggle?**
- **≤3 opsi, setara, switch cepat** → Segmented Toggle (pill)
- **3+ opsi, navigasi view/section** → Tab (rounded-xl)

### 3.3 Button

Semua variant sudah di `globals.css`. Aturan:

- **`.btn-primary`** — 1 aksi utama per view (Submit, Save, Create)
- **`.btn-ghost`** — aksi sekunder dengan border (Cancel/Batal, Import, Copy, secondary CTA berpasangan dengan primary)
- **`.btn-secondary`** — aksi netral tanpa border, background abu (filter, toggle mode, aksi yang tidak bersebelahan dengan primary)
- **`.btn-danger`** — aksi destructive (Delete, Hapus, Disconnect)
- **`.btn-icon`** — icon-only, tidak ada teks. Wajib `title` + `aria-label`. Contoh: Settings gear, close X di toolbar

**Ukuran (sudah ter-include):**
- Default: `px-4 py-2 text-sm` — standar semua button utama
- Icon di dalam: append `flex items-center gap-2` + icon `w-4 h-4`
- Full-width: append `w-full` atau `flex-1`
- Icon-only: `p-2` square + min `44x44` untuk tap target mobile (pola berbeda, bukan pakai `.btn-primary`)

**Jangan** tulis `px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600` inline — pakai `.btn-primary`. Kalau butuh beda ukuran/warna di luar varian yang ada, **tambah varian baru di `globals.css`** (misal `.btn-primary-lg`), jangan improvisasi di call-site.

### 3.4 Badge

Pakai `.badge .badge-{kategori}`. Untuk badge custom (status, tipe kontak), ikut pola:
```
inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-{color}-50 dark:bg-{color}-900/30 text-{color}-600 dark:text-{color}-400
```

**Size:**
- Default badge kategori: `px-3 py-1 text-xs`
- Badge chip kecil (di list padat): `px-2 py-0.5 text-[10px]` atau `text-xs`
- Badge prominent (di header detail): `px-3 py-1.5 text-sm`

### 3.5 Card

Pakai `.card` (dengan hover) atau `.card-static` (tanpa hover).

- **`.card`** — clickable card, list item yang bisa di-klik (Business card, invoice row)
- **`.card-static`** — KPI card, chart wrapper, info panel di halaman detail

**Jangan** tumpuk `.card` di dalam `.card` — pakai nested panel biasa: `bg-gray-50 dark:bg-gray-800 rounded-xl p-4`.

### 3.6 Modal

Komponen: [`src/components/ui/Modal.tsx`](../src/components/ui/Modal.tsx). Selalu pakai komponen ini — **jangan** bikin modal manual dengan `fixed inset-0`.

- Max-width default: `sm:max-w-md`. Kalau butuh lebih lebar, override via props (perlu extend komponen — tambahkan prop `size` kalau belum ada).
- Footer opsional. Tombol di footer: primary di kanan, secondary/cancel di kiri.
- Backdrop: `bg-black/40 backdrop-blur-sm` (sudah built-in).

### 3.7 Input / Form Field

Pakai `.input` untuk `<input>`, `<select>`, `<textarea>`. Pakai `.label` untuk label.

**Pattern field lengkap:**
```tsx
<div>
  <label className="label">Nama bisnis</label>
  <input type="text" className="input" />
  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Helper text</p>
</div>
```

Error state: tambahkan `border-red-400 focus:ring-red-500` + pesan error `text-sm text-red-600 mt-1`.

### 3.8 Chart

Pakai Recharts. Warna default:
- Line/bar primary: `#6366f1` (primary-500)
- Revenue/income: `#10b981` (emerald-500)
- Expense: `#ef4444` (red-500)
- Grid: `#e5e7eb` light, `#374151` dark (set via `<CartesianGrid stroke="...">`)

Card wrapper chart: `.card-static` dengan `h-80` atau `h-96` untuk chart container.

---

## 4. Layout Patterns

### 4.1 Halaman Dashboard (`(dashboard)/` routes)

Struktur standar:
```tsx
<div className="space-y-6">
  {/* Header */}
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Judul Halaman</h1>
    <button className="btn-primary">Aksi Utama</button>
  </div>

  {/* KPI cards (opsional) */}
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    {/* ... */}
  </div>

  {/* Main content */}
  <div className="card-static">{/* ... */}</div>
</div>
```

### 4.2 Empty State

```tsx
<div className="text-center py-12">
  <Icon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
  <p className="text-gray-600 dark:text-gray-400 mb-4">Belum ada data</p>
  <button className="btn-primary">Tambah pertama</button>
</div>
```

### 4.3 Loading Skeleton

```tsx
<div className="animate-pulse">
  <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
</div>
```

### 4.4 Nested Panel (info box)

```tsx
<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul</p>
  <p className="text-xs text-gray-500 dark:text-gray-400">Deskripsi...</p>
</div>
```

---

## 5. Dark Mode

- Class-based via `next-themes`: kelas `.dark` ditambahkan ke `<html>`
- **Setiap color utility wajib punya pasangan `dark:`** — tidak ada pengecualian. CI akan menangkap inline class yang lupa dark variant suatu saat.
- Hindari `bg-white` tanpa `dark:bg-gray-800`, `text-gray-800` tanpa `dark:text-gray-100`, dst.
- Reference mapping ada di [docs/dark-mode-hover-locations.md](./dark-mode-hover-locations.md)

---

## 6. Accessibility

- **Tap target mobile:** minimum `44x44` untuk button icon-only (pakai `min-h-[44px] min-w-[44px]` kalau perlu)
- **Focus ring:** pakai `focus:ring-2 focus:ring-primary-500` (sudah di `.input`). Jangan hapus outline tanpa pengganti.
- **Disabled state:** `disabled:opacity-50 disabled:cursor-not-allowed`
- **Alt text:** semua `<img>` wajib ada alt. Icon decoratif di dalam button yang sudah ada label text tidak perlu alt.
- **Aria label:** button icon-only wajib `aria-label`

---

## 7. Do / Don't Quick Reference

| Kasus | ✅ Do | ❌ Don't |
|-------|------|---------|
| Warna brand | `bg-primary-500` | `bg-indigo-500` |
| Button primary | `className="btn-primary"` | Inline `px-4 py-2 bg-primary-500...` |
| Badge kategori | `className="badge badge-earn"` | Custom bg-green-100 text-green-700 |
| Binary toggle (2 opsi) | `rounded-full` pill, active `bg-white text-indigo-500` | `bg-primary-500 text-white` fill |
| Tab navigation | `rounded-xl` container + `rounded-lg` child | Toggle pattern untuk 4+ tab |
| Card | `.card` atau `.card-static` | Inline `bg-white rounded-2xl shadow-sm...` |
| Modal | `<Modal>` component | Custom fixed inset-0 |
| Dark mode | Selalu pair `dark:` | `text-gray-800` tanpa pasangan |

---

## 8. Roadmap Komponen

Status ekstraksi ke `src/components/ui/`:

- [x] `<SegmentedToggle>` — pattern Section 3.1 → [src/components/ui/SegmentedToggle.tsx](../src/components/ui/SegmentedToggle.tsx). **Wajib** digunakan untuk semua binary/ternary toggle — jangan tulis inline lagi.
- [ ] `<Tabs>` — ekstraksi pattern Section 3.2
- [ ] `<Button>` — wrapper dengan variant prop (primary/secondary/danger/ghost + size)
- [ ] `<Badge>` — wrapper dengan variant prop (category/status/custom color)
- [ ] `<EmptyState>` — wrapper pattern Section 4.2

Sampai diekstraksi, **copy pattern dari Section 3** — jangan improvisasi.

### `<SegmentedToggle>` usage

```tsx
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';

<SegmentedToggle
  value={period}
  onChange={setPeriod}
  options={[
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ]}
  ariaLabel="Period"
/>
```

Props: `options` (dengan `icon?` opsional), `value`, `onChange`, `fullWidth?` (untuk modal/auth page), `disabled?`, `ariaLabel?`, `className?`.

---

## 9. Export ke Claude Design

Dokumen ini + folder berikut dirancang untuk dikonsumsi Claude Design saat "Set up your design system":

- **Link code:** arahkan ke repo GitHub ini. Prioritaskan folder:
  - `src/components/ui/` — komponen primitif
  - `app/globals.css` — token CSS + utility classes
  - `tailwind.config.js` — design tokens (warna primary)
  - `docs/DESIGN_SYSTEM.md` — dokumen ini (narasi & spec)
- **Company blurb:** "AXION (Katalis Ventura) — platform akuntansi double-entry untuk UKM Indonesia. Next.js + Tailwind, dark/light mode, bahasa utama Indonesia."
- **Assets:** logo AXION (ikon bintang oranye), font default Tailwind (sans-serif)

Ketika menambah/merubah komponen kanonik, update dokumen ini terlebih dahulu sebelum commit — supaya Claude Design selalu menerima spec yang sinkron.
