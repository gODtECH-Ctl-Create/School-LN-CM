# School LN CM

> Curriculum-driven lesson planning and school management.

School LN CM is being built as a multi-tenant platform for schools to manage academic calendars, curricula, teacher assignments and lesson notes. Teachers will be able to generate curriculum-aware lesson notes, save them to a personal library and reuse them across the academic session.

## First pilot

**Future Speakers International School (FSIS)**

- School code: `FSIS`
- Initial academic target: Primary 5, First Term
- Initial curriculum source: UBE (Universal Basic Education) scheme of work
- Initial commercial assumption: ₦10,000 per term

## Authentication

- School administrators: registered email + password.
- Teachers/staff: school-issued Staff ID such as `FSIS-T-0001` + password.
- Access is tenant-aware and protected by PostgreSQL Row Level Security (RLS).

## Stack

- Next.js
- React
- TypeScript
- Supabase Auth
- PostgreSQL / Supabase
- Supabase Storage (planned)
- Artificial intelligence lesson generation (planned)

## Current foundation

- Next.js application scaffold
- Supabase browser/server clients
- Session-refresh middleware
- Multi-tenant database schema
- School membership and role model
- FSIS seed tenant
- Term subscription plan seed
- Academic session, term, class, subject and teacher-assignment foundations
- RLS policies for tenant isolation
- Unified administrator/staff login screen

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

Create `.env.local` from `.env.example` and add the Supabase project URL and publishable anonymous key. Apply the migration in `supabase/migrations/` to the project's database.

Do not commit service-role keys or other secrets.
