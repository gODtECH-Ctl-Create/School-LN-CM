# School LN CM

> Curriculum-driven lesson planning and school management.

School LN CM is a multi-tenant platform for schools to manage academic calendars, curricula, teacher assignments and lesson notes. Teachers will be able to prepare curriculum-aware lesson notes, save them to a personal library and reuse them across the academic session.

## First pilot

**Future Speakers International School (FSIS)**

- School code: `FSIS`
- Initial academic target: Primary 5, First Term
- Initial curriculum source: UBE (Universal Basic Education) scheme of work
- Initial commercial assumption: ₦10,000 per term

## Authentication

- School administrators: registered email + password.
- Teachers/staff: real email + password, created through a school invitation.
- Staff IDs such as `FSIS-T-0001` remain internal school record identifiers, not login credentials.
- A person can belong to more than one school through separate school memberships.
- Access is tenant-aware and protected by PostgreSQL Row Level Security (RLS).

## UI/UX foundation

School LN CM has a repository-level UI/UX skill and concrete design system so new screens remain coherent across roles and devices.

- UI/UX implementation skill: `.agents/skills/ui-ux/SKILL.md`
- Design system: `docs/DESIGN-SYSTEM.md`
- Shared application shell: `src/components/app-shell.tsx`
- Responsive visual tokens and component patterns: `src/app/globals.css`

The product should feel calm, academic, trustworthy and operational. The interface is designed around real school workflows rather than generic dashboard patterns. Teachers are treated as mobile-first classroom users while administrators get clearer operational controls.

## Current foundation

- Next.js application scaffold
- Supabase browser/server clients
- Session-refresh middleware
- Multi-tenant database schema
- School membership and role model
- FSIS seed tenant
- Term subscription plan seed
- Academic session, term, class, subject and teacher-assignment foundations
- Row Level Security (RLS) policies for tenant isolation
- Email invitation onboarding and account activation
- Server-side Staff ID allocation
- Role-aware application shell
- Responsive administrator staff management workflow
- Teacher and administrator workspace dashboard foundations

## Stack

- Next.js
- React
- TypeScript
- Supabase Auth
- PostgreSQL / Supabase
- Supabase Storage (planned)
- Artificial intelligence lesson generation (planned)

## Development sequence

1. Multi-tenant authentication and school onboarding
2. Academic calendar and session management
3. Curriculum ingestion and structured curriculum management
4. First Term Primary 5 curriculum import
5. Lesson-note templates
6. Curriculum-aware lesson generation
7. Teacher library and version history
8. Approval workflow and school analytics
9. Subscription/payment workflow
10. Mobile applications for Android and iOS

## Local setup

Create `.env.local` from `.env.example` and add the Supabase project URL, publishable anonymous key and server-only Supabase secret key. Apply the migrations in `supabase/migrations/` to the project database.

Do not commit Supabase secrets or other private credentials.
