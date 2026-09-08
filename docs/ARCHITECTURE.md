# School LN CM architecture

## Product boundary

School LN CM is a multi-tenant school platform. A tenant is a school. Future Speakers International School (FSIS) is the first pilot tenant.

The application must never trust a school identifier supplied by the browser as proof of access. The authenticated user's membership and PostgreSQL Row Level Security (RLS) are the source of truth.

## Identity model

The authentication identity is the person's real email address. School membership and staff records are separate application concepts:

```text
auth.users
    ↓
profiles
    ↓
school_memberships
    ↓
staff_profiles
    ↓
teacher_assignments
```

A teacher is onboarded by a school administrator through **Staff → Add Teacher**. The administrator supplies the teacher's name, email and optional teaching assignments. The server allocates the school's Staff ID, creates the inactive school membership and staff profile, and sends the Supabase Auth invitation email.

The teacher follows the invitation, creates a password, and the server activates the membership only after the invitation is verified. The Staff ID remains useful for school records, attendance, reporting, payroll integrations and staff directories, but it is not an authentication credential.

The same `auth.users.id` can have memberships in multiple schools. Tenant context is therefore resolved as:

```text
Authenticated user
        ↓
active school membership
        ↓
role + permissions
        ↓
tenant-owned records protected by RLS
```

School administrators authenticate with their registered email and password. Google OAuth and passwordless email are future options, not requirements for the first pilot.

## Invitation lifecycle

```text
provisioning → pending → accepted
                    └──→ revoked
                    └──→ expired
                    └──→ failed
```

The `staff_invitations` table records the school, invited email, Staff ID, Auth user, membership, timestamps and lifecycle status. The database prevents more than one active invitation for the same email in the same school.

Supabase Auth's `inviteUserByEmail()` is called only from trusted server-side code using the Supabase secret key. The invite redirect points to `/accept-invitation`. The invitation's effective email-link lifetime is controlled by the Supabase Auth email OTP expiration setting. This implementation records the same one-hour application expiry by default so the product's state stays aligned with the default Supabase setting.

Invitation revocation deactivates the pending school membership. We intentionally do not delete the Auth user automatically because one Auth identity may eventually belong to multiple schools.

## Tenant boundary

Core tenant-owned records contain or derive a `school_id`:

```text
schools
  ├── school_memberships
  ├── staff_profiles
  ├── staff_invitations
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

1. Never expose the Supabase secret key to the browser.
2. Never rely on frontend school IDs for authorization.
3. Every tenant query must be constrained by authenticated membership.
4. Use RLS for database-level isolation.
5. Staff onboarding and Auth user creation happen through trusted server-side code.
6. Keep school data after subscription expiry; restrict paid operations rather than deleting data.
7. Keep inactive memberships inaccessible to teachers until their invitation is accepted.

## Supabase Auth setup

Set these environment variables on the server:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
```

In Supabase Authentication settings, add the production and local `/accept-invitation` URL to the allowed redirect URLs. Customize the **Invite user** email template so `{{ .ConfirmationURL }}` is the main Accept Invitation button.

A suitable first template message is:

> Welcome to School LN CM. Future Speakers International School has invited you to join its teaching workspace. Click **Accept Invitation** to create your password and activate your teacher account.

The current application implementation uses Supabase's built-in invitation mailer. A branded ABEmail or other transactional-email provider can replace that later using Supabase's `generateLink()` flow without changing the underlying identity model.
