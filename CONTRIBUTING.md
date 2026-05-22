# Contributing to Examly

Thank you for contributing to the **Examly** Learning Management and Assessment Platform! To ensure the codebase remains lightweight, highly performant, and maintainable, please follow these guidelines when submitting contributions.

---

## Code of Conduct & Core Principles

Every contribution must adhere to our core project principles:
1. **Lightweight & High Performance**: Avoid adding heavy external libraries. Utilize built-in React features, modern Web APIs, and optimal database queries/views.
2. **Mobile First**: All user views (student portal, exam engines, dashboards) must be fully responsive and tailored for both mobile and desktop screen sizes.
3. **Zero-Trust Security**: Ensure route permissions and API endpoints validate user roles (`student` vs `admin`) and maintain PostgreSQL Row-Level Security (RLS).
4. **Clean Code**: Adhere to type safety (avoid `any` types), write concise reusable components, and keep formatting consistent.

---

## Local Development Workflow

### Prerequisites
- **Node.js**: Version 18 or above (LTS recommended)
- **NPM**: Default package manager for dependency resolution

### Setup Instructions
1. **Clone & Install**:
   ```bash
   npm install
   ```
2. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   *This starts the Vite server and generates the route definitions dynamically in `src/routeTree.gen.ts`.*

3. **Verify Build**:
   Before submitting any changes, verify that the production SSR and client builds compile successfully:
   ```bash
   npm run build
   ```

---

## Directory Organization

Please organize new files according to the established structure:

```text
src/
├── components/          # Reusable UI component modules
│   └── ui/              # Atomized Radix UI components (Shadcn UI)
├── hooks/               # Custom hooks for backend queries & auth state
├── integrations/        # Client adapters for Supabase connections
├── lib/                 # Core utility scripts and authentication checks
├── routes/              # TanStack router tree (File-based Routing)
└── types/               # Type definitions and Supabase mapping
```

---

## Git Conventions

### Branch Naming Style
- **Features**: `feature/your-feature-name`
- **Stabilization & Bugfixes**: `bugfix/issue-description` or `stabilization/area`
- **Documentation**: `docs/update-title`

### Commit Message Guidelines
We use structured commit prefixes for clean git histories:
- `feat`: A new user-facing feature (e.g. `feat: implement student wallet request modal`)
- `fix`: A bug fix or stabilization adjustment (e.g. `fix: prevent anti-cheat window blur timeout trigger on reload`)
- `docs`: Documentation updates only (e.g. `docs: add contributing specifications file`)
- `build`: Build systems, bundler setups, or dependency updates (e.g. `build: update routeTree after compilation`)
- `style`: Formatting, spacing, and styling changes without behavior modifications

---

## Database Migrations

Examly uses **Supabase** for database management. All schema modifications must be tracked using PostgreSQL migrations:
- Place migrations in `supabase/migrations/` using chronological naming (e.g. `YYYYMMDDHHMMSS_description.sql`).
- Enable Row-Level Security (RLS) on all new tables and specify policies for `student` and `admin` roles.
- Leverage materialized views (e.g. `rankings_view`) for high-performance aggregations rather than executing heavy run-time joins.
