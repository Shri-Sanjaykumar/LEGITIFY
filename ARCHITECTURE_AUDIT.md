# LEGITIFY Architecture Audit

## 1. Missing Routes
* **`/company/[id]`**: Specified in `MASTER_ARCHITECTURE.md` for company-specific trust metrics and registration histories, but not implemented in the current frontend MVP.
* **`/admin`**: Specified in `MASTER_ARCHITECTURE.md` for administrators to manage scanned files, review false positives, and view platform metrics, but not implemented.
* **`/report/list` or `/dashboard/reports`**: There is no dedicated page for viewing all previous reports; the sidebar links for "Reports" and "Companies" currently redirect to `/dashboard` as a fallback.

## 2. Dead Code
* Cleaned up all unused imports (`cn`, `motion`, `FileText`, `getTrustColor`, `isActive`, `isPending`, etc.) across components in the latest linting pass.
* Remaining mock-data functions (e.g. `mockActivityFeed`, `mockRecentScans`) are fully utilized by their respective dashboard/report components.

## 3. Missing Components
* **Backend API Integration Layer**: All frontend routes currently use mock data from `src/lib/mock-data.ts`. No HTTP fetch or axios client is wired up to actual server routes.
* **Real-time File Upload & Parsing Handler**: `FileUpload.tsx` uses `react-dropzone` but only simulates file extraction locally via progress timeouts. It does not send multipart form data to any parser.
* **Auth System (Session Persistence)**: Login and register pages are client-only forms that perform basic validations and redirect to `/dashboard`. They do not store JWTs or track session state.
* **Real Interactive Charts**: Recharts components (`TrustChart`, `RiskRadar`) use static data generated on render rather than dynamic API datasets.

## 4. Build Blockers
* **None**: Next.js compilation compiles 100% successfully (`npm run build` completed).
* **None**: ESLint checks pass 100% cleanly with zero warnings or errors.

## 5. Security Issues
* **Client-side Routing Protection**: There is no middleware or React context checking if a user is logged in before accessing `/dashboard`, `/scan`, or `/report/[id]`. Anyone can access these routes.
* **Client-side Form Validation**: Auth forms perform only minimal length and regex checks. There is no password hashing on the client (nor should there be) but no backend exists to handle credentials securely.
* **No Input Sanitization**: Text and URL inputs in the scan page do not run sanitization or HTML escaping, posing a potential XSS vulnerability if input were rendered unsafely (though it is currently static/safe).
* **Sensitive Configs**: Hardcoded API endpoints or keys do not exist yet, which is good, but environmental configs are currently empty.

## 6. Accessibility (a11y) Issues
* **Interactive Elements**: Custom buttons and interactive cards (`GlowCard`, stats widgets) lack explicit `role="button"`, `aria-expanded`, or keyboard navigation event handlers (e.g. `onKeyDown`).
* **Charts accessibility**: Recharts graphics do not contain `aria-label` descriptions or alternative text representations, making them unreadable for screen readers.
* **Color Contrast**: Some muted text colors (`var(--text-tertiary)`) have low contrast ratios against the ultra-dark `#06060b` background.

## 7. Performance Issues
* **Bundle Size (Framer Motion)**: Large framer-motion animations are loaded on the main client bundles. Dynamic loading (`next/dynamic`) should be used to split large libraries.
* **Chart Re-renders**: Recharts triggers layout redraws during window resizing. The chart container throws a width/height style warning during pre-rendering:
  > *The width(-1) and height(-1) of chart should be greater than 0, please check the style of container, or the props width(100%) and height(100%)...*
* **Static Site Generation (SSG)**: `/report/[id]` is dynamic but resolves to `/report/demo` via mock routing. Under real conditions, SSR (`getServerSideProps` or React Server Components) will be needed, which will impact time-to-first-byte (TTFB).
