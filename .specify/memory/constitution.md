<!--
Sync Impact Report:
Version change: [NONE] → 1.0.0 (Initial constitution)
Modified principles: N/A (Initial creation)
Added sections: All sections (initial creation)
Removed sections: N/A
Templates requiring updates:
  ✅ .specify/templates/plan-template.md - Constitution Check section already present
  ✅ .specify/templates/spec-template.md - Requirements section aligns with principles
  ✅ .specify/templates/tasks-template.md - Task organization supports principle-driven development
Follow-up TODOs: None
-->

# Web-Cal Constitution

## Core Principles

### I. Component-First Architecture

Every feature MUST be broken down into reusable, composable React components. Components MUST:

- Be independently testable and self-contained
- Have a single, clear responsibility
- Use TypeScript for complete type safety
- Follow controlled/uncontrolled component patterns appropriately
- Accept props via well-defined interfaces

**Rationale**: Component isolation enables parallel development, easier testing, and maintainability. Strong typing prevents runtime errors and improves developer experience.

### II. Type Safety (NON-NEGOTIABLE)

All code MUST use TypeScript with strict mode enabled. Type safety requirements:

- NO `any` types except when interfacing with untyped libraries (must be documented)
- All props, state, and function signatures MUST have explicit types
- Use discriminated unions for complex state machines
- Prefer interfaces for public APIs, types for internal structures
- All data models MUST have corresponding TypeScript interfaces in `src/types/`

**Rationale**: Type safety catches errors at compile time, serves as living documentation, and enables confident refactoring. The `any` escape hatch undermines the entire type system.

### III. State Management Discipline

Application state MUST follow clear boundaries and patterns:

- **Local state**: Component-specific UI state uses React `useState`/`useReducer`
- **Global state**: Cross-cutting concerns use Zustand stores with persist middleware
- **Server state**: Data fetching abstracted through provider pattern (`DataProviderContext`)
- State updates MUST be immutable
- Side effects MUST be clearly isolated in `useEffect` with explicit dependencies

**Rationale**: Clear state boundaries prevent prop-drilling, improve testability, and make data flow predictable. The provider pattern enables swapping data sources (demo/WebCal/CalDAV) without component changes.

### IV. Accessibility & Progressive Enhancement

User interfaces MUST be accessible and work without JavaScript where feasible:

- Semantic HTML elements over divs
- ARIA attributes where semantic HTML insufficient
- Keyboard navigation fully supported
- Color contrast meets WCAG AA minimum
- PWA offline-first: service worker caches app shell
- Graceful degradation for unsupported browsers

**Rationale**: Accessibility is not optional. PWA capabilities ensure the calendar works offline, critical for a productivity tool.

### V. Visual Consistency & Theming

Visual appearance MUST follow consistent patterns:

- Tailwind CSS for all styling (no inline styles except dynamic colors)
- Radix UI primitives for complex interactive components (dialogs, popovers, tooltips)
- Dark/light theme support via CSS custom properties
- Responsive design: mobile-first breakpoints (sm, md, lg)
- Event styling centralized through EventType system

**Rationale**: Tailwind enforces design tokens. Radix provides accessible primitives. Centralized event styling prevents inconsistent visual treatment.

### VI. Data Provider Abstraction

All external data access MUST go through the DataProvider interface:

- Providers implement: `listEvents`, `createEvent`, `updateEvent`, `deleteEvent`
- Providers handle their own authentication/connection logic
- No direct CalDAV/WebCal logic outside `src/lib/*-provider.ts`
- Components consume events via `DataProviderContext`, agnostic to source

**Rationale**: Abstraction enables swapping backends without UI changes. Providers encapsulate complexity (CORS proxies, authentication, data formats).

### VII. Simplicity & YAGNI

Implementation MUST start simple and only add complexity when proven necessary:

- Avoid premature abstraction
- Prefer composition over inheritance
- No unused code or "future-proofing" patterns
- Libraries/dependencies justified by concrete need
- Code removed is better than code commented out

**Rationale**: Over-engineering increases cognitive load and maintenance burden. Simple solutions are easier to understand, debug, and modify.

## Development Workflow

### Code Quality Gates

All changes MUST pass:

1. **TypeScript compilation**: `tsc -b` with zero errors
2. **Linting**: `npm run lint` with zero warnings (ESLint + typescript-eslint)
3. **Build**: `npm run build` succeeds
4. **Manual testing**: Feature works in dev mode (`npm run dev`)

### Commit Standards

- Commits MUST be atomic (one logical change per commit)
- Commit messages follow conventional format: `type(scope): description`
  - Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
  - Example: `feat(calendar): add week view time grid`
- Breaking changes MUST include `BREAKING CHANGE:` in commit body

### Code Review Checklist

Before merging, verify:

- [ ] TypeScript strict checks pass (no `any`, no type assertions without justification)
- [ ] Component props have documented interfaces
- [ ] State updates are immutable
- [ ] No hardcoded values (colors, URLs, strings) that should be configurable
- [ ] Responsive design tested at mobile/tablet/desktop breakpoints
- [ ] Dark mode appearance checked
- [ ] Console has zero errors/warnings in dev mode
- [ ] Build artifacts generated without warnings

## Constraints

### Technology Stack (MUST NOT deviate without constitutional amendment)

- **Runtime**: React 19, TypeScript 5.9+
- **Build**: Vite 7, vite-plugin-pwa
- **Styling**: Tailwind CSS 3.4+
- **UI Primitives**: Radix UI
- **State**: Zustand with persist middleware
- **Date handling**: date-fns 4.x
- **Icons**: lucide-react
- **Routing**: react-router-dom

### Performance Targets

- **Initial load**: < 3s on 3G connection (Lighthouse mobile score > 80)
- **Time to Interactive**: < 5s on mobile
- **Bundle size**: Main chunk < 300KB gzipped
- **Calendar render**: Month view renders < 500ms for 100 events

### Security Requirements

- NO secrets in source code (API keys, tokens, passwords)
- CalDAV credentials stored only in browser localStorage (user-controlled)
- CORS proxies configurable by user (no default proxy that sees credentials)
- Content Security Policy configured in PWA manifest

## Governance

### Amendment Process

1. Propose change as PR modifying this constitution
2. Document rationale and migration impact in PR description
3. Update dependent templates (plan-template, spec-template, tasks-template)
4. Increment version according to semantic versioning
5. Merge only after approval and sync validation

### Version Semantics

- **MAJOR**: Principle removed, technology stack changed, backward-incompatible governance
- **MINOR**: New principle added, expanded guidance, new mandatory section
- **PATCH**: Clarifications, wording improvements, typo fixes

### Compliance

- Constitution supersedes all other development practices
- PRs violating principles MUST either fix violations or amend constitution first
- Complexity violations require explicit justification in PR (see plan-template.md "Complexity Tracking")

### Runtime Guidance

For agent-specific implementation guidance, see project-specific guidance files if they exist (e.g., `docs/contributing.md`, `.github/DEVELOPMENT.md`).

**Version**: 1.0.0 | **Ratified**: 2026-03-30 | **Last Amended**: 2026-03-30
