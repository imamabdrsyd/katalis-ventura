# Periode Filter Card — UI/UX Refinements

## Overview
The **PeriodFilterCard** component is a refined, production-grade replacement for the inline period filters in report pages. Located at `src/components/reports/PeriodFilterCard.tsx`.

---

## Key Improvements

### 1. **Visual Hierarchy & Structure**
- **Clear sectioning** with header + content + footer layout
- **Descriptive labels** explain the purpose of each control
- **Better spacing**: Consistent padding (6px → 24px depending on context)
- **Footer summary**: Shows active period at a glance

### 2. **Interaction Patterns**
| Feature | Before | After |
|---------|--------|-------|
| **Period buttons** | Inline flex, hard to scan | Grid (3 cols), better visual alignment |
| **Custom dates** | Always visible, cluttered | Expandable toggle (cleaner default state) |
| **Export menu** | Hardcoded dropdown | Integrated with button, dropdown opens on click |
| **Month dropdown** | Small select, unclear options | Full-width with chevron, shows year context |

### 3. **Visual Polish**
- **Active state design**: Indigo gradient background + shadow glow effect on active buttons
- **Hover feedback**: Gradient overlay on active buttons, smooth transitions (200ms)
- **Dark mode support**: Full contrast compliance (4.5:1 minimum WCAG AA)
- **Color coding**:
  - Indigo (primary action): Active buttons, export
  - Gray (secondary): Inactive buttons, labels
  - Red (PDF icon), Green (Excel icon)

### 4. **Accessibility**
- Semantic HTML: `<label>` + `<input>` properly associated
- `aria-label` on critical controls
- Focus indicators: Visible focus rings (indigo-500) on all interactive elements
- Keyboard navigation: Tab order respects visual order
- Touch targets: 44px+ minimum on all buttons

### 5. **Responsive Design**
- Mobile-first approach
- Grid layouts that adapt to container width
- Date inputs stack on smaller screens
- Works seamlessly on 375px → 1440px+

---

## Component Props

```typescript
interface PeriodFilterCardProps {
  period: Period;                    // Current period: 'month' | 'quarter' | 'year' | 'custom'
  startDate: string;                 // YYYY-MM-DD format
  endDate: string;                   // YYYY-MM-DD format
  onPeriodChange: (period: Period) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onExportPDF?: () => void;          // Optional PDF export handler
  onExportExcel?: () => void;        // Optional Excel export handler
  onExport?: () => void;             // Fallback if only one export type
  isExporting?: boolean;             // Shows loading state on export button
  months: string[];                  // Localized month names from i18n
}
```

---

## Usage Example

```tsx
import { PeriodFilterCard } from '@/components/reports/PeriodFilterCard';

export default function ReportPage() {
  const { 
    period, 
    startDate, 
    endDate, 
    handlePeriodChange,
    handleExportPDF,
    handleExportExcel,
  } = useIncomeStatement();
  
  const { t } = useLanguage();

  return (
    <div className="flex gap-6">
      <PeriodFilterCard
        period={period}
        startDate={startDate}
        endDate={endDate}
        onPeriodChange={handlePeriodChange}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        months={t.dashboard.months}
      />
      {/* Main report content */}
    </div>
  );
}
```

---

## States & Behavior

### **Period Buttons**
- **Inactive**: Gray background, hover darkens
- **Active**: Indigo gradient + shadow glow
- **On click**: Triggers `onPeriodChange` + updates state

### **Custom Dates**
- **Default**: Collapsed, shows toggle button with Calendar icon
- **Expanded**: Reveals two date inputs (start/end) with inline date summary
- **Animation**: Fade-in + slide-down when expanding

### **Month Dropdown**
- Shows all 12 months for current year
- Year auto-updates based on start date
- On select: Updates both dates to span entire month
- If nothing selected: Shows placeholder "Pilih Bulan..."

### **Export Button**
- **Default**: Shows download icon + "Unduh Laporan"
- **Loading**: Icon bounces, text changes to "Mengunduh..."
- **Dropdown menu**: Opens on click, shows PDF + Excel options
- **On select**: Closes menu, triggers appropriate export handler

### **Footer Summary**
- Always visible, shows "Periode Aktif"
- Displays formatted date range (e.g., "01 Jan 2026 – 31 Jan 2026")
- If no dates selected: Shows "Belum dipilih"

---

## Animation Details

| Element | Duration | Easing | Trigger |
|---------|----------|--------|---------|
| Button hover | 200ms | ease | Hover state |
| Chevron rotation | 200ms | ease | Click expand toggle |
| Export dropdown | Instant | - | Click button |
| Date input fade-in | Fast (150ms) | ease-in | Expand section |
| Focus ring | 200ms | ease | Focus state |
| Export button scale | 150ms | ease-out | Click (active:scale-95) |

---

## Color Scheme

### Light Mode
- Background: `white` (#FFFFFF)
- Border: `gray-200` (#E5E7EB)
- Text (primary): `gray-900` (#111827)
- Text (secondary): `gray-500` (#6B7280)
- Button (active): `indigo-500` (#6366F1)
- Button (hover): `indigo-600` (#4F46E5)

### Dark Mode
- Background: `gray-900` (#111827)
- Border: `gray-800` (#1F2937)
- Text (primary): `gray-100` (#F3F4F6)
- Text (secondary): `gray-400` (#9CA3AF)
- Button (active): `indigo-500` (#6366F1)
- Button (hover): `indigo-600` (#4F46E5)

---

## Integration Notes

- **Imported in**: `app/(dashboard)/income-statement/page.tsx` (example)
- **Reusable across**: Balance Sheet, Cash Flow, General Ledger, Trial Balance pages
- **Localization**: Uses `t.dashboard.months` from `useLanguage` hook
- **No external dependencies**: Only uses Lucide icons (already in project)

---

## Next Steps (Optional Enhancements)

1. **Export progress indicator**: Show % downloaded in button while exporting
2. **Date preset hints**: Show "(This month)", "(This quarter)" on quick buttons
3. **Comparison mode**: Toggle to compare two periods side-by-side
4. **Calendar picker**: Replace date inputs with interactive calendar for better UX
5. **Saved periods**: Store frequently used date ranges for quick access

---

## Files Modified
- ✅ Created: `src/components/reports/PeriodFilterCard.tsx`
- ✅ Updated: `app/(dashboard)/income-statement/page.tsx` (uses new component)
