# School LN CM architecture

## Product boundary

School LN CM is a multi-tenant school platform. A tenant is a school. Future Speakers International School (FSIS) is the first pilot tenant.

The application must never trust a school identifier supplied by the browser as proof of access. The authenticated user's membership and PostgreSQL Row Level Security (RLS) are the source of truth.

## Identity model

- **Platform administrator**: platform-level operations.
- **School administrator**: manages one school.
- **Academic coordinator**: manages academic structure and curriculum operations.
- **Teacher**: prepares and manages assigned lesson notes.
- **Staff**: future non-teaching school staff.

Administrators authenticate with their registered email and password.

Teachers/staff use a school-issued Staff ID such as `FSIS-T-0001`. The first authentication implementation maps that identifier to a non-human internal Supabase Auth email alias. The real Staff ID remains the user's visible identifier and is stored in `staff_profiles`.

## Tenant boundary

Core tenant-owned records contain or derive a `school_id`:

```text
schools
  ├── school_memberships
  ├── academic_sessions
  │     └── terms
  ├── classes
  ├── subjects
  ├── teacher_assignments
  ├── curricula (next phase)
  └── lesson_notes (next phase)
```

For records that do not directly contain `school_id`, access is derived through their parent record and checked by RLS policies.

## Subscription model

The first commercial plan is `Term Starter` at ₦10,000 per term. The database stores monetary values in kobo, so ₦10,000 is represented as `1,000,000` kobo.

Pricing is data-driven rather than hard-coded into the application. This allows future plans without a schema rewrite.

## Academic model

The calendar is deliberately separate from the curriculum. A school may move instructional days because of holidays, closures, examinations or events. The future curriculum scheduler will map curriculum weeks to actual instructional dates using the school's calendar.

## Security rules

1. Never expose the Supabase service-role key to the browser.
2. Never rely on frontend school IDs for authorization.
3. Every tenant query must be constrained by authenticated membership.
4. Use RLS for database-level isolation.
5. Staff onboarding and Auth user creation should happen through trusted server-side code.
6. Keep school data after subscription expiry; restrict paid operations rather than deleting data.
