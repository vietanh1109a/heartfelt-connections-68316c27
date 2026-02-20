
# Fix Build Errors and "Infinity" Display

## Problem 1: "Infinity/Infinity" showing for switch count
Admin users get `maxSwitches = Infinity` (JavaScript value), which renders as literal "Infinity" text in the UI. Need to display "Unlimited" or the infinity symbol instead.

## Problem 2: Build errors in edge functions

### 2a. `assign-cookie/index.ts` (lines 56-57)
The Supabase join `cookie_stock!inner(...)` returns an **array**, not an object. So `first.cookie_stock` is `{ id, is_active, cookie_data }[]`, not a single object. Need to access `first.cookie_stock[0]` or cast properly.

### 2b. `report-cookie/index.ts`, `send-otp/index.ts`, `verify-otp/index.ts`
`error` in catch blocks is typed as `unknown` in strict TypeScript/Deno. Need to use `(error as Error).message`.

---

## Changes

### 1. `src/pages/index/SidePanel.tsx`
- Line 146 (VIP view): Change `{switchesLeft}/{maxSwitches}` to show "Unlimited" or the infinity symbol when `maxSwitches` is `Infinity`
- Line 190 (FREE view): Same change
- Line 235 (report button): Same change

### 2. `src/pages/index/IndexModals.tsx`
- Lines 507, 521: Format `maxSwitches` display to handle Infinity

### 3. `supabase/functions/assign-cookie/index.ts`
- Lines 56-57: Change `first.cookie_stock?.is_active` to `first.cookie_stock?.[0]?.is_active` (and same for `cookie_data`)

### 4. `supabase/functions/report-cookie/index.ts`
- Line 255: Change `error.message` to `(error as Error).message`

### 5. `supabase/functions/send-otp/index.ts`
- Line 122: Change `error.message` to `(error as Error).message`

### 6. `supabase/functions/verify-otp/index.ts`
- Line 213: Change `error.message` to `(error as Error).message`

---

## Technical Details

For the Infinity display, a helper approach will be used inline:
- When `maxSwitches === Infinity`, display the infinity symbol or "Unlimited" instead of the raw number
- Format: `{switchesLeft}/Unlimited` for admins, `{switchesLeft}/{maxSwitches}` for others

For the assign-cookie join issue, Supabase's `!inner` join with a singular foreign key actually returns a single object in practice, but TypeScript infers it as an array. Using `(first as any).cookie_stock?.is_active` or indexing `[0]` will fix the type error.
