# Dark Mode Hover Locations

Dokumentasi lokasi source code yang mempengaruhi efek dan warna hover pada dark mode.

## TransactionList.tsx

| Line | Element | Class |
|------|---------|-------|
| [81](../src/components/transactions/TransactionList.tsx#L81) | Row hover | `dark:hover:bg-gray-700` |
| [111](../src/components/transactions/TransactionList.tsx#L111) | Edit button | `dark:hover:text-gray-300` |
| [127](../src/components/transactions/TransactionList.tsx#L127) | Delete button | `dark:hover:text-gray-300` |

## Global Styles (globals.css)

| Line | Element | Class |
|------|---------|-------|
| [29](../app/globals.css#L29) | `.card` class | `dark:hover:border-gray-600` |
| [41](../app/globals.css#L41) | `.btn-secondary` | `dark:hover:bg-gray-600` |

## Layout & Navigation (layout.tsx)

| Line | Element | Class |
|------|---------|-------|
| [143](../app/(dashboard)/layout.tsx#L143) | Mobile menu button | `dark:hover:text-gray-200`, `dark:hover:bg-gray-700` |
| [155](../app/(dashboard)/layout.tsx#L155) | Business switcher | `dark:hover:text-indigo-400` |
| [173](../app/(dashboard)/layout.tsx#L173) | Business dropdown item | `dark:hover:bg-gray-700` |
| [213](../app/(dashboard)/layout.tsx#L213) | Add business button | `dark:hover:bg-indigo-900/30` |
| [229](../app/(dashboard)/layout.tsx#L229) | Search button | `dark:hover:text-gray-200`, `dark:hover:bg-gray-700` |
| [258](../app/(dashboard)/layout.tsx#L258) | Logout button | `dark:hover:text-red-400`, `dark:hover:bg-red-900/30` |
| [299](../app/(dashboard)/layout.tsx#L299) | Sidebar close button | `dark:hover:text-gray-200` |
| [335](../app/(dashboard)/layout.tsx#L335) | Sidebar nav items | `dark:hover:bg-gray-700` |

## Modal (Modal.tsx)

| Line | Element | Class |
|------|---------|-------|
| [58](../src/components/ui/Modal.tsx#L58) | Close button | `dark:hover:bg-gray-700` |

## Theme Toggle (ThemeToggle.tsx)

| Line | Element | Class |
|------|---------|-------|
| [30](../src/components/ui/ThemeToggle.tsx#L30) | Toggle button | `dark:hover:bg-gray-600` |

## Transactions Page (transactions/page.tsx)

| Line | Element | Class |
|------|---------|-------|
| [186](../app/(dashboard)/transactions/page.tsx#L186) | Quick add Earn button | `dark:hover:bg-green-900/50` |
| [196](../app/(dashboard)/transactions/page.tsx#L196) | Quick add Spend button | `dark:hover:bg-red-900/50` |

## Business Card (BusinessCard.tsx)

| Line | Element | Class |
|------|---------|-------|
| [86](../src/components/business/BusinessCard.tsx#L86) | Card hover | `dark:hover:border-gray-600` |
| [141](../src/components/business/BusinessCard.tsx#L141) | Edit button | `dark:hover:bg-gray-600` |
| [152](../src/components/business/BusinessCard.tsx#L152) | Delete button | `dark:hover:bg-red-900/50` |
| [163](../src/components/business/BusinessCard.tsx#L163) | Select button | `dark:hover:bg-indigo-900/50` |

## Businesses Page (businesses/page.tsx)

| Line | Element | Class |
|------|---------|-------|
| [143](../app/(dashboard)/businesses/page.tsx#L143) | Tab button | `dark:hover:bg-gray-700` |
| [153](../app/(dashboard)/businesses/page.tsx#L153) | Tab button | `dark:hover:bg-gray-700` |

## Auth Pages

### Login (login/page.tsx)

| Line | Element | Class |
|------|---------|-------|
| [92](../app/(auth)/login/page.tsx#L92) | Forgot password link | `dark:hover:text-indigo-300` |
| [105](../app/(auth)/login/page.tsx#L105) | Sign up link | `dark:hover:text-indigo-300` |

### Signup (signup/page.tsx)

| Line | Element | Class |
|------|---------|-------|
| [127](../app/(auth)/signup/page.tsx#L127) | Role selection label | `dark:hover:bg-gray-700` |
| [148](../app/(auth)/signup/page.tsx#L148) | Role selection label | `dark:hover:bg-gray-700` |
| [176](../app/(auth)/signup/page.tsx#L176) | Login link | `dark:hover:text-indigo-300` |

---

## Tips

### Menghilangkan hover effect di dark mode

Untuk menghilangkan efek hover di dark mode, gunakan warna yang sama dengan background:

```tsx
// Contoh: row dengan background gray-800
className="hover:bg-gray-100 dark:hover:bg-gray-800"
```

Atau gunakan `transparent`:

```tsx
className="hover:bg-gray-100 dark:hover:bg-transparent"
```

### Common dark mode hover colors

| Background | Hover |
|------------|-------|
| `dark:bg-gray-800` | `dark:hover:bg-gray-700` |
| `dark:bg-gray-900` | `dark:hover:bg-gray-800` |
| `dark:bg-gray-700` | `dark:hover:bg-gray-600` |

---

*Last updated: 2026-01-31*
