# UI Architecture & React Lifecycle Guidelines

## 1. The 3-Tier Component Pattern

To eliminate hydration crashes, hook order mismatches, and cascading render bugs, UI components must follow this 3-tier structure:

```
Tier 1: Route Gate (Container / Hydration Boundary)
   │ (Passes resolved, non-null domain entity via props)
   ▼
Tier 2: Keyed Feature View (e.g. key={tournament.id} or key={tier.id})
   │ (Deconstructs presentation and delegates to leaves)
   ▼
Tier 3: Pure Presentational Leaf Components (Tables, Forms, Cards, Chips)
```

### Tier 1: Route Gate (Container)
- **Role**: Reads URL parameters, queries global hooks/stores, evaluates loading & hydrated state, and renders top-level loading/404 screens.
- **Strict Invariants**:
  - **ZERO local form or display state** (`useState` for filters/forms is forbidden here).
  - **ZERO `useEffect`s**.
  - All hooks must execute unconditionally before any return statement.
  - Passes resolved, guaranteed non-null entities down to Tier 2 with a dynamic `key`:
    ```tsx
    export const ManageTournamentSettingsPage: React.FC = () => {
      const { slug } = useParams<{ slug: string }>();
      const { getTournamentBySlug, isLoading, isHydrated } = useTournament();

      if (isLoading || !isHydrated) {
        return <LoadingScreen message="Loading tournament settings..." />;
      }

      const tournament = slug ? getTournamentBySlug(slug) : undefined;
      if (!tournament) return <TournamentNotFound />;

      return <TournamentSettingsView key={tournament.id} tournament={tournament} />;
    };
    ```

### Tier 2: Keyed Feature View
- **Role**: Manages the screen layout, navigation guards (e.g. unsaved changes speedbumps), and ephemeral UI state (modals, active search filters).
- **Strict Invariants**:
  - Receives resolved domain models via props (`tournament: Tournament`, `tier: BracketTier`). Never accepts nullable props that require loading spinners.
  - Automatically resets all internal state upon route or entity changes by virtue of `key={entity.id}`.
  - **ZERO `useEffect`s for resetting state** (e.g. do not write `useEffect(() => setIsDirty(false), [tournament.id])`—remounting handles this natively).

### Tier 3: Pure Presentational Leaf Components
- **Role**: Display data and collect user input (e.g. `LeaderboardTable`, `PlaystyleChip`, `MatchCard`).
- **Strict Invariants**:
  - Driven purely by props.
  - Emits events upward via callbacks (`onSave`, `onSelect`, `onChange`).
  - Contains no network calls or global store subscriptions.

---

## 2. "You Might Not Need an Effect" (Anti-`useEffect` Rules)

`useEffect` should be considered an architectural red flag when used for component-internal logic.

1. **NO Effects to Reset State on Prop/ID Changes**:
   - ❌ `useEffect(() => { setQuery(''); }, [tier.id]);`
   - ✅ Provide `key={tier.id}` on the child component so React mounts a clean instance.
2. **NO Effects to Synchronize Props or URL Parameters**:
   - ❌ `useEffect(() => { setSearchParams({ tier: tier.slug }); }, [tier]);`
   - ✅ Read directly from URL parameters during render: `const tier = tiers.find(t => t.slug === searchParams.get('tier')) || tiers[0];`
3. **NO Effects to Calculate Derived Values**:
   - ❌ `useEffect(() => { setTotal(a + b); }, [a, b]);`
   - ✅ Calculate inline in the component body: `const total = a + b;` (or `useMemo` for heavy computation).
4. **Permitted Uses of `useEffect`**:
   - Synchronizing with non-React external browser APIs: `document.title = ...`, `window.addEventListener('resize', ...)`, DOM observer cleanup.

---

## 3. Web Storage Invariants

1. **Domain Data (Tournaments, Matches, Players, Scores, Qualifiers, Orgs)**:
   - **PostgreSQL ONLY** via Drizzle ORM and backend API routes.
   - Never store domain objects in `localStorage` or `sessionStorage`.
2. **Persistent User Viewport Preferences**:
   - `localStorage` is permitted **only** for device-specific display preferences:
     - `tm_sidebar_collapsed`: Sidebar open/close toggle.
     - `tournament_matrix_size_<tierId>` / `col_w`: Matrix table density and custom column width.
3. **Navigation & Active Tabs**:
   - Always use **URL paths or query parameters** (`/:slug/gold` or `?tier=gold`).
   - Do not use `sessionStorage` to mirror or remember tab navigation.

---

## 4. Styling

1. **Tailwind v4** is loaded through the `@tailwindcss/vite` plugin with preflight on. Headings, lists, links and form controls carry no browser styling, so set size, weight and color with classes.
2. **Theme tokens live in `src/index.css`** inside `@theme`: colors (`bg-surface`, `text-fg-secondary`, `border-line`, `text-gold-bright`, ...), font sizes (`text-3xs` to `text-hero`), radii, shadows and animations. Use a token class instead of a raw value. For translucency, use the token with an alpha modifier (`bg-seed-indigo/15`). A color with no token may be an arbitrary class (`text-[#d8b4fe]`) when used once; once it's used in two places, add a token. Never swap a hex value for a Tailwind palette name; v4 palette colors are OKLCH and don't match.
3. **Hex color data lives in `src/theme/palette.ts`**: tier theme defaults, render-time theme fallbacks, status, playstyle, QR and chroma-key colors. These are values stored on tiers and orgs or passed into themed components, not static UI colors.
4. **Shared components live in `src/components/ui`**: `Button` / `buttonClasses()`, `IconButton`, `Badge`, `Chip`, `Card`, and `useMediaQuery` / `useIsMobile`. Use them before writing a one-off styled element: `Chip` (with `accent` for tier colors) for pill toggles such as tier selectors, filters and view modes; `IconButton` with a plain-words `aria-label` for icon-only buttons; `Card` for surface panels. There are no global component classes.
5. **Conditional classes go through `cn()`** (`src/components/ui/cn.ts`), which joins class names and resolves Tailwind conflicts so later classes win.
6. **Inline `style` is only for runtime values**, such as tier colors or layout coordinates computed at render time. Pass them as plain values, or as CSS custom properties when hover/focus variants need them (`style={{ '--row-hover': tint }}` with `hover:bg-(--row-hover)`); everything static is a class. Never mutate `element.style` in event handlers; use `hover:`/`focus-visible:` classes, or `group` / `group-hover:` when a parent's hover styles a child.
7. **`npm run lint` enforces these rules** (`no-restricted-syntax` in `eslint.config.js`): static inline styles, `style={variable}`, `CSSProperties` constants, style mutation, legacy `btn`/`badge` classes, and hex literals anywhere in `src` outside `src/theme/palette.ts`, `src/db/**` and tests. Check a single file with `npx eslint <file>`. The only allowed exception is a style object built in a helper and returned to the caller (such as bracket canvas positioning) or a third-party component that only accepts `style`; mark it with `// eslint-disable-next-line no-restricted-syntax -- runtime: <reason>`.

### Overlays

Every modal, drawer and confirmation uses `src/components/overlay`. Never render a hand-rolled fixed backdrop.

* **`Overlay`** renders the backdrop and panel in a portal, traps Tab focus, restores focus on close, locks page scroll, and makes only the topmost overlay react to Escape. Props:
  * `open`, `onClose`: `onClose` actually closes (the parent sets its open state to false).
  * `variant`: `'modal'` (centered, default) or `'drawer'` (full-height, slides in from the right).
  * `dirty`: the form has unsaved changes. Compute it by comparing current state with the values the form opened with.
  * `busy`: a request is in flight; every dismissal is ignored.
  * `dismissible`: `false` ignores backdrop and Escape; X and Cancel still follow the dirty rule.
  * `aria-labelledby` / `aria-label`: name the dialog (use `useId()` for the title id).
  * `panelClassName`: static panel classes (width, background, border, radius, shadow). `panelStyle`: runtime-only values such as tier-themed gradients. `panelTestId`: `data-testid` on the panel.
  * `children`: nodes, or a render function `({ requestClose }) => …`. Wire every X and Cancel button to `requestClose` so it applies the rules below. Save/Confirm handlers call the parent's close directly, with no prompt.
* **`ConfirmDialog`**: title, body, Cancel and Confirm buttons on top of `Overlay`, with `tone` (`danger`, `warning`, `info`), `confirmVariant`, `busy`, `confirmDisabled` and `extraActions`.
* **`DiscardChangesDialog`**: the standard "Discard unsaved changes?" prompt (Keep Editing / Discard Changes). `Overlay` shows it automatically when a dirty overlay is dismissed; use it directly for page-level navigation guards.

The dismissal rule (`resolveDismissal` in `dismissal.ts`):

| Overlay state | Outside click/tap | Escape | X or Cancel |
| :--- | :--- | :--- | :--- |
| Not dirty | Closes | Closes | Closes |
| Dirty | Discard prompt | Discard prompt | Discard prompt |
| Busy | Ignored | Ignored | Ignored (buttons disabled) |
| `dismissible={false}` | Ignored | Ignored | Follows the dirty rule |

On the Discard prompt, an outside click or Escape means Keep Editing. While an overlay is dirty, closing or reloading the tab also triggers the browser's leave-page warning.
