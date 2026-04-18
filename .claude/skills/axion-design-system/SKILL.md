---
name: axion-design-system
description: Apply AXION design system when creating or modifying UI components, pages, or styling in the Katalis Ventura repo. Triggers on work that touches TSX/JSX files with className, Tailwind utilities, or visual elements — buttons, badges, cards, modals, toggles, tabs, forms, charts. Use proactively whenever UI work is happening to keep the product visually consistent.
---

# AXION Design System

You are working in the **Katalis Ventura** repo (product branding: **AXION**) — a double-entry accounting platform for Indonesian SMBs built with Next.js + Tailwind + TypeScript.

The full design system spec lives in **[docs/DESIGN_SYSTEM.md](../../../docs/DESIGN_SYSTEM.md)**. That file is the source of truth — read it when you need the complete reference.

## Core rules

1. **Never invent classes inline when a utility exists.** `globals.css` provides `.card`, `.card-static`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.input`, `.label`, `.badge` + `.badge-{earn|opex|var|capex|tax|fin}`. Use them.

2. **Always pair dark mode.** Every `bg-*`, `text-*`, `border-*` that sets a visible color needs a `dark:` pasangan. No exceptions.

3. **Use `primary-*` (indigo scale), not `indigo-*` directly.** The brand token is defined in `tailwind.config.js`.

4. **Respect the component patterns.** When building a toggle/tab/button/badge/card/modal, copy the canonical pattern from `docs/DESIGN_SYSTEM.md` §3 — don't improvise.

## The toggle distinction (common source of inconsistency)

- **Segmented Toggle** (2–3 options, mutually exclusive, values setara):
  - Container `rounded-full` + `bg-gray-100 dark:bg-gray-700` + `p-1`
  - Child `rounded-full` + `px-4 py-1.5 text-sm`
  - Active: `bg-white dark:bg-gray-600 text-indigo-500 dark:text-indigo-400 font-semibold shadow-sm`
  - Inactive: `bg-transparent text-gray-500 dark:text-gray-400 font-normal` + hover
  - Reference: [src/components/charts/MonitoringChart.tsx:262-283](../../../src/components/charts/MonitoringChart.tsx#L262-L283)

- **Tab Navigation** (3+ options, switching views/sections):
  - Container `rounded-xl` + `bg-gray-100 dark:bg-gray-800` + `p-1`
  - Child `rounded-lg` + `px-4 py-2 font-medium`
  - Active: `bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm` (no color accent)
  - Reference: [app/(dashboard)/roi-forecast/page.tsx:170](../../../app/(dashboard)/roi-forecast/page.tsx#L170)

- **Never** use `bg-primary-500 text-white` for an active toggle state — that's a **Button** pattern, not a Toggle.

## Workflow when doing UI work

1. **Before writing classes**, check if a utility class in `globals.css` covers the case.
2. **Before building a toggle/tab/modal/card**, copy the canonical pattern from `docs/DESIGN_SYSTEM.md` §3.
3. **Before committing**, scan the diff for:
   - Missing `dark:` pairs
   - Inline `bg-indigo-*` or `bg-primary-500 text-white` that should be `.btn-primary`
   - Inline card classes that should be `.card` / `.card-static`
   - Toggles that don't match the canonical pattern
4. **If you change a canonical component** (MonitoringChart toggle, Modal, utility class definition), **update `docs/DESIGN_SYSTEM.md` in the same session** — treat it like `ACCOUNTING_LOGIC.md`: live doc, must stay in sync.

## When user asks for "new" components

If the user asks for a component that doesn't exist yet (e.g. "dropdown menu", "tooltip"):
1. Check `src/components/ui/` first — may already exist.
2. Check `docs/DESIGN_SYSTEM.md` §8 roadmap — may be planned.
3. If truly new, propose the visual spec (radius, colors, spacing) aligned with existing tokens before coding — then add to `docs/DESIGN_SYSTEM.md` once built.

## What to never do

- ❌ `bg-indigo-500` — use `bg-primary-500`
- ❌ Inline `px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors` — use `.btn-primary`
- ❌ `text-gray-800` tanpa `dark:text-gray-100`
- ❌ Active toggle dengan `bg-primary-500 text-white` fill
- ❌ Bikin modal manual dengan `fixed inset-0` — pakai `<Modal>` di `src/components/ui/Modal.tsx`
- ❌ Bikin card dengan inline `bg-white rounded-2xl shadow-sm border border-gray-100 dark:...` — pakai `.card` / `.card-static`

---

When in doubt, defer to `docs/DESIGN_SYSTEM.md`. When that doc is silent, ask the user before inventing a new pattern.
