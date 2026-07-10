# AXION Design System

> **Live document** — setiap perubahan pada token, komponen kanonik, atau pattern UI wajib update dokumen ini di sesi yang sama.
> Source of truth untuk semua keputusan visual di Katalis Ventura (branding: **AXION**).
>
> Terakhir diupdate: 10 Juli 2026 (shadow card Airbnb, ghost badge, underline tab bar animasi Framer)

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

**Source of truth: [`src/lib/categoryColors.ts`](../src/lib/categoryColors.ts)** — `CATEGORY_BADGE_CLASSES` dan `CATEGORY_TEXT_CLASSES`.
Gunakan `<CategoryBadge category={...} />` atau import langsung dari `categoryColors.ts`.

| Kategori | Color | Text class |
|----------|-------|------------|
| EARN | emerald | `text-emerald-700 dark:text-emerald-400` |
| OPEX | red | `text-red-700 dark:text-red-400` |
| VAR | pink | `text-pink-700 dark:text-pink-400` |
| CAPEX | blue | `text-blue-700 dark:text-blue-400` |
| TAX | yellow | `text-yellow-700 dark:text-yellow-400` |
| FIN | indigo | `text-indigo-700 dark:text-indigo-400` |

> **Light mode pakai shade `-700`, bukan `-600`.** Badge tinted (`bg-{color}-50` + teks `-{color}-700`) menjamin kontras ≥4.5:1 (WCAG AA). Dengan `-600`, EARN/OPEX/VAR/TAX gagal threshold di atas `bg-*-50`. Dark mode tetap `-400`.

> `globals.css` punya `.badge-*` classes — **jangan dipakai**, isinya outdated dan tidak sinkron. Selalu pakai `categoryColors.ts`.

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

Gaya shadow card mengikuti Airbnb: **lembut, diffuse, tanpa border di light mode** — separasi card dari background datang murni dari shadow. Token custom didefinisikan di `tailwind.config.js` (`theme.extend.boxShadow`).

| Token | Nilai | Pakai untuk |
|-------|-------|-------------|
| `shadow-card` | `0 1px 2px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.05)` | Card resting (semua card/panel di atas `bg-gray-50`) |
| `shadow-card-hover` | `0 6px 16px rgba(0,0,0,.12)` | Card hover/elevated (dipakai `.card` saat hover) |
| `shadow-sm` | Tailwind default | Active toggle button, tab indicator, kontrol kecil — **bukan card** |
| `shadow-2xl` | Tailwind default | Modal |
| `shadow-none` | — | Flat panel, nested surface |

**Aturan border card:** light mode `border-transparent` (borderless, Airbnb-style); dark mode tetap `dark:border-gray-700` karena shadow tidak terlihat di background gelap. Border dipertahankan hanya bila elemen butuh definisi saat overlap konten (contoh: sticky toolbar, chat bubble, sub-card di atas parent putih).

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
| `.btn-primary` | Tombol utama indigo solid — untuk aksi dalam modal/tabel/footer |
| `.btn-primary-glow` | CTA primer high-emphasis — gradien + glow, untuk auth & form halaman penuh |
| `.btn-secondary` | Tombol sekunder abu solid |
| `.btn-outline` | Tombol border primary (aksi penting tapi bukan CTA utama, contoh: Quick Entry) |
| `.btn-ghost` | Tombol dengan border abu (secondary action, cancel, import) |
| `.btn-icon` | Tombol icon-only square, tidak ada teks |
| `.btn-danger` | Tombol destructive merah |
| `.input` | Input/select/textarea standar |
| `.label` | Label form standar |
| `.badge` + `.badge-{kategori}` | Badge kategori transaksi |
| `.h-screen-dvh` | Tinggi layar penuh dengan `100dvh` + fallback `100vh` — pakai ini, bukan `h-screen`, untuk elemen full-height (URL bar mobile) |
| `.max-h-modal` | `max-height: 90dvh` + fallback `90vh` — untuk container modal |

**Kalau butuh variant baru** (misal `.btn-ghost`, `.badge-status`) — tambahkan di `globals.css`, jangan inline.

**Mobile/webview (sudah global — jangan duplikasi di call-site):**
- CSS var `--safe-area-top` / `--safe-area-bottom` (`env(safe-area-inset-*)`) — dipakai elemen `fixed` yang nempel tepi layar: `pt-[var(--safe-area-top)]`, `bottom-[calc(1.25rem+var(--safe-area-bottom))]`, dll. Viewport di-set `viewport-fit=cover` di `app/layout.tsx`.
- Form control otomatis min 16px di layar <768px (anti auto-zoom iOS) — jangan lawan dengan `!text-*` kecil di mobile.
- `-webkit-tap-highlight-color` sudah transparent global — feedback sentuh datang dari `active:scale` di utility button.

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

**Pakai untuk:** navigasi antar view dalam halaman yang sama (Overview/Input/Variance, Balance/Match Statement, Active/Archived).

**Selalu pakai komponen `<Tabs>`** — jangan tulis inline. Komponen sudah terekstraksi di [`src/components/ui/Tabs.tsx`](../src/components/ui/Tabs.tsx).

```tsx
import { Tabs } from '@/components/ui/Tabs';

<Tabs
  value={activeTab}
  onChange={setActiveTab}
  tabs={[
    { value: 'overview', label: 'Overview', icon: <LayoutIcon className="w-4 h-4" /> },
    { value: 'input',    label: 'Input' },
  ]}
/>
```

Props: `tabs` (dengan `icon?`, `badge?`, `hidden?`), `value`, `onChange`, `scrollable?`, `className?`.

**Spec (variant `pill` — satu-satunya canonical variant):**
- Container: `bg-[#EEF0F2] dark:bg-gray-800` + `rounded-xl` + `p-1`
- Child: `rounded-lg` + `px-4 py-1.5` + `text-sm font-medium`
- Active indicator: `motion.span` dengan `layoutId` — **spring sliding** (`stiffness: 400, damping: 35`), `bg-white dark:bg-gray-700 shadow-sm`
- Active text: `text-gray-800 dark:text-gray-100`
- Inactive text: `text-gray-500 dark:text-gray-400` + hover `text-gray-700 dark:text-gray-300`
- Overflow mobile: tambahkan `scrollable` prop → wraps dengan `overflow-x-auto scrollbar-hide`

**Kapan pilih Tab vs SegmentedToggle?**
- **2 opsi binary, switch sangat cepat** → `<SegmentedToggle>` (pill full-rounded)
- **2+ opsi, navigasi view/section** → `<Tabs>` (rounded-xl container)

**Underline tab bar (standalone, bukan komponen `<Tabs>`)** — dipakai untuk tab tingkat-halaman di dalam card besar (AR/AP: AR/AP/Payment History; Transactions: All/Draft/Posted/Unsettled/Recurring). Bukan pill — deretan tombol di atas garis `border-b`, dengan indikator underline animasi. **Semua tab underline seperti ini wajib pakai animasi Framer**, bukan `border-b-2` statis:
- Container: `flex` di atas `border-b border-gray-200 dark:border-gray-700`
- Child: `relative px-4 py-2.5 text-sm font-medium border-b-2 border-transparent transition-colors` (border child selalu transparan — underline datang dari `motion.span`)
- Active text: `text-indigo-600 dark:text-indigo-400` — inactive `text-gray-500 dark:text-gray-400` + hover `text-gray-700 dark:text-gray-300`
- Indikator: `motion.span` dengan `layoutId` yang di-share (via `useId()`), dirender hanya di tab aktif:
  ```tsx
  <motion.span layoutId={tabLayoutId}
    className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-indigo-500 dark:bg-indigo-400"
    transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
  ```
- Count badge: pill kecil `min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold`, warna ikut konteks (indigo default, amber untuk "belum lunas")

**Jangan:**
- ❌ Tulis inline — selalu pakai `<Tabs>`
- ❌ Pakai `variant="underline"` — sudah tidak digunakan, `pill` adalah satu-satunya canonical variant

### 3.3 Button

Semua variant sudah di `globals.css`. Aturan:

- **`.btn-primary`** — 1 aksi utama per view (Submit, Save, Create)
- **`.btn-primary-glow`** — CTA primer yang perlu lebih menonjol: halaman auth (Sign In, Create Account), onboarding, form simpan transaksi. Gradien `indigo-500→600` + `shadow-indigo-500/20`. Gunakan sebagai pengganti `.btn-primary` saat tombol adalah satu-satunya CTA di layar atau butuh emphasis visual lebih tinggi.
- **`.btn-ghost`** — aksi sekunder dengan border (Cancel/Batal, Import, Copy, secondary CTA berpasangan dengan primary)
- **`.btn-secondary`** — aksi netral tanpa border, background abu (filter, toggle mode, aksi yang tidak bersebelahan dengan primary)
- **`.btn-danger`** — aksi destructive (Delete, Hapus, Disconnect)
- **`.btn-icon`** — icon-only, tidak ada teks. Wajib `title` + `aria-label`. Contoh: Settings gear, close X di toolbar

**Kapan pakai `.btn-primary` vs `.btn-primary-glow`:**

| Konteks | Variant |
|---------|---------|
| Tombol di dalam form multi-field di halaman penuh (Tambah Transaksi, Edit Akun) | `.btn-primary-glow` |
| Tombol CTA tunggal di halaman auth / onboarding | `.btn-primary-glow` |
| Tombol di dalam modal, dropdown, row tabel | `.btn-primary` |
| Tombol berpasangan dengan secondary/cancel di footer modal | `.btn-primary` |

**Ukuran (sudah ter-include):**
- Default: `px-4 py-2 text-sm` — standar semua button utama
- Icon di dalam: append `flex items-center gap-2` + icon `w-4 h-4`
- Full-width: append `w-full` atau `flex-1`
- Icon-only: `p-2` square + min `44x44` untuk tap target mobile (pola berbeda, bukan pakai `.btn-primary`)

**Interaction states (sudah ter-include di semua varian — jangan tambahkan lagi di call-site):**
- Press feedback: `active:scale-[0.98]` (`.btn-icon` pakai `active:scale-95` karena kecil) + `motion-reduce:transform-none`
- Keyboard focus: `focus-visible:ring-2` warna primary (varian danger/emerald pakai warna semantiknya) + `ring-offset-2` + `dark:focus-visible:ring-offset-gray-900`
- Transisi: `transition-all duration-150` (bukan `transition-colors` — scale ikut dianimasikan)

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

**Varian ghost** (badge outline tanpa fill) — dipakai untuk chip status yang tidak perlu menonjol berat (mis. Pay Debt / Receive Payment di halaman AR/AP). Warna semantik ada di border + teks, tanpa background:
```
px-2 py-0.5 rounded-full text-xs font-semibold border border-{color}-200 dark:border-{color}-800/60 text-{color}-600 dark:text-{color}-400
```

### 3.5 Card

Pakai `.card` (dengan hover) atau `.card-static` (tanpa hover).

- **`.card`** — clickable card, list item yang bisa di-klik (Business card, invoice row). Hover: `shadow-card-hover` + lift `-translate-y-1`
- **`.card-static`** — KPI card, chart wrapper, info panel di halaman detail

Anatomi (Airbnb-style, lihat §1.8): `bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-transparent dark:border-gray-700 p-6` — **tanpa border terlihat di light mode**, separasi dari shadow diffuse.

**Jangan** tumpuk `.card` di dalam `.card` — pakai nested panel biasa: `bg-gray-50 dark:bg-gray-800 rounded-xl p-4`.

### 3.6 Modal

Komponen: [`src/components/ui/Modal.tsx`](../src/components/ui/Modal.tsx). Selalu pakai komponen ini — **jangan** bikin modal manual dengan `fixed inset-0`.

- Max-width default: `sm:max-w-md`. Kalau butuh lebih lebar, override via props (perlu extend komponen — tambahkan prop `size` kalau belum ada).
- Footer opsional. Tombol di footer: primary di kanan, secondary/cancel di kiri.
- Backdrop: `bg-black/40 backdrop-blur-sm` (sudah built-in).
- `headerAction` (opsional): elemen aksi di header, dirender tepat di kiri tombol close. `closeButtonClassName` (opsional): kelas tambahan untuk tombol close (mis. `sm:hidden`). Kombinasi keduanya dipakai mis. di TransactionDetailModal — di desktop tombol Duplicate menggantikan icon close (close diwakili klik di luar modal/Esc), di mobile tombol close tetap ada.

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
- [x] `<Tabs>` — [`src/components/ui/Tabs.tsx`](../src/components/ui/Tabs.tsx). **Wajib** digunakan untuk semua tab navigation — jangan tulis inline. Canonical variant: `pill` (spring sliding). `variant="underline"` deprecated.
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

## 8.5 Landing Page Pattern (Editorial)

Landing page publik ([app/page.tsx](../app/page.tsx)) memakai gaya **editorial fintech** — disiplin tipografi & whitespace, minim gradient, motion restrained-expressive via `framer-motion`. Pola ini terpisah dari dashboard (yang lebih utilitarian).

### 8.5.1 Eyebrow text

Label kecil di atas setiap heading section. Selalu uppercase, tracking lebar, neutral gray.

```tsx
<p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400 mb-5">
  {eyebrow}
</p>
```

- **Jangan** pakai badge berwarna (`bg-indigo-100 text-indigo-700`) untuk eyebrow landing — itu pola dashboard.
- **Jangan** pakai dot `animate-pulse` di samping eyebrow — overdone.

### 8.5.2 Type scale landing

Lebih besar & lebih ketat dari dashboard. Inter, weight 600/700.

| Token | Class | Pakai untuk |
|-------|-------|-------------|
| Display | `text-[clamp(2.75rem,7.2vw,5.75rem)] font-bold leading-[0.95] tracking-[-0.035em]` | Hero h1 |
| Section heading | `text-3xl md:text-4xl lg:text-[2.75rem] font-bold leading-[1.05] tracking-[-0.02em]` | Heading section (h2) |
| Closing heading | `text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.025em]` | Closing CTA band |
| Lead | `text-base md:text-lg leading-relaxed` (atau `text-lg md:text-xl` di hero) | Paragraf intro |
| Body | `text-sm md:text-base leading-relaxed` | Body item list |

**Aturan warna heading:** solid `text-gray-900 dark:text-gray-100`. **Jangan** pakai gradient text `bg-clip-text` di landing — sudah dianggap "AI-slop". Untuk menekankan, pakai split warna: 1 baris solid + 1 baris `text-gray-400 dark:text-gray-600`.

### 8.5.3 Section rhythm

- **Container:** `container mx-auto px-6 max-w-6xl`
- **Section padding:** `py-24 md:py-32` (closing & hero boleh lebih).
- **Alternating surface:** putih → `bg-gray-50 dark:bg-gray-900/40` dengan `border-y border-gray-200 dark:border-gray-800` → putih. Hindari shadow tebal untuk separasi section.
- **Closing band:** `bg-gray-950 text-white` untuk kontras akhir.

### 8.5.4 Editorial split list (pengganti feature-card-3-kolom)

Untuk daftar 3 fitur, **jangan** pakai 3 card seragam dengan icon di kiri atas (cliché AI). Pakai **editorial split**:

```tsx
<div className="grid grid-cols-[auto_1fr] gap-x-6 md:gap-x-10 py-7 border-b border-gray-200 dark:border-gray-800">
  <span className="text-sm font-mono font-medium text-gray-400 dark:text-gray-600 pt-1 tabular-nums">
    01
  </span>
  <div>
    <h3 className="text-lg md:text-xl font-semibold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
      {title}
    </h3>
    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
      {body}
    </p>
  </div>
</div>
```

- Nomor `01/02/03` mono + tabular-nums di kolom kiri sebagai grid marker.
- Border tipis sebagai pemisah, bukan card surface.
- Hover berubah warna heading ke `primary-*`, **bukan** `-translate-y-*` (anti AI-slop).

### 8.5.5 CTA primer

Landing pakai pill rounded penuh + neutral inverse (bukan `.btn-primary` indigo) **dengan hover ke primary-* untuk aksen brand**. Ini sengaja beda dari dashboard: rest state neutral untuk kontras maksimum + nuansa editorial, hover memunculkan warna brand.

```tsx
<Link
  href="/login"
  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-primary-600 dark:bg-white dark:text-gray-900 dark:hover:bg-primary-500 dark:hover:text-white transition-colors cursor-pointer"
>
  {label}
  <ArrowRightIcon />
</Link>
```

CTA sekunder = text link dengan ikon arrow yang nudge:

```tsx
<a className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group cursor-pointer">
  {label}
  <span className="transition-transform group-hover:translate-x-1">→</span>
</a>
```

### 8.5.6 Motion (framer-motion)

`framer-motion` v12 terdaftar di [package.json](../package.json). Pola yang dipakai:

| Pola | Kapan | Konfig |
|------|-------|--------|
| `fadeUp` section enter | Setiap section selain hero | `opacity 0→1`, `y 16→0`, `duration 0.5`, `ease [0.22,1,0.36,1]`, `viewport once: true` |
| `fadeUpStagger` parent | Container yang membungkus beberapa anak `fadeUp` | `staggerChildren 0.08`, `delayChildren 0.05` |
| Hero word reveal | Hanya h1 hero | Tiap kata `motion.span` dengan `opacity 0→1`, `y 24→0`, di-stagger lewat parent |
| `useReducedMotion()` | Selalu | Skip animasi jika user prefer reduced motion |

Definisi variants ada di [app/page.tsx](../app/page.tsx). **Jangan** tambah scroll-linked parallax atau infinite loop animation — itu masuk kategori AI-slop untuk produk fintech.

### 8.5.7 Trust strip (logo marquee + inline stats)

Logo bisnis pelanggan ditampilkan **warna asli** (no grayscale filter). Marquee tetap dipakai untuk social proof.

Stats menggunakan layout **inline baseline** — angka besar dan label uppercase tiny **sejajar pada baseline yang sama**, bukan stacked vertical. Ini supaya selaras secara optis dengan eyebrow text di sisi kiri trust strip:

```tsx
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="font-semibold text-gray-900 dark:text-gray-100 text-lg tabular-nums leading-none">
        {value}
      </span>
      <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-500 dark:text-gray-500">
        {label}
      </span>
    </div>
  );
}
```

### 8.5.8 Apa yang tidak boleh muncul di landing

- ❌ Hero gradient text `from-indigo-600 to-purple-600 bg-clip-text text-transparent`
- ❌ Background indigo-50 untuk shell page
- ❌ CTA dengan `bg-gradient-to-r animate-...` bg-position trick
- ❌ Badge eyebrow berwarna dengan dot pulse
- ❌ 3 feature cards seragam icon-top-left dengan `hover:-translate-y-1`
- ❌ Shadow blur tebal sebagai pemisah section
- ❌ Emoji sebagai icon (pakai SVG / lucide)

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
