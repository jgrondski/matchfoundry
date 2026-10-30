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

1. **Tailwind v4** is loaded through the `@tailwindcss/vite` plugin. Preflight is off until the Phase 11 cleanup step, so existing global rules still apply.
2. **Theme tokens live in `src/index.css`** inside `@theme`: colors (`bg-surface`, `text-fg-secondary`, `border-line`, `text-gold-bright`, ...), font sizes (`text-3xs` to `text-hero`), radii, shadows and animations. Use a token class instead of a raw value. The old `--color-bg-*` / `--color-text-*` variable names still resolve until the cleanup step.
3. **Shared components live in `src/components/ui`**: `Button` / `buttonClasses()`, `IconButton`, `Badge`, `Chip`, `Card`, and `useMediaQuery` / `useIsMobile`. Use them before writing a one-off styled element.
4. **Conditional classes go through `cn()`** (`src/components/ui/cn.ts`), which joins class names and resolves Tailwind conflicts so later classes win.
5. **Inline `style` is only for runtime values**, such as tier colors or layout coordinates computed at render time. Pass them as plain values or CSS custom properties; everything static is a class. `npm run lint:styles -- <files>` reports static inline styles.
6. Converting an existing component: follow the [conversion guide](specs/phase-11/11.2-conversion-guide.html).
