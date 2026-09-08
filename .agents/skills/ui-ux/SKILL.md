# School LN CM UI/UX Skill

## Purpose

You are the UI/UX implementation authority for School LN CM. Every interface must feel like one coherent product, not a collection of unrelated screens. Protect the product's information architecture, visual language, interaction patterns, accessibility, and school-workflow context while still allowing thoughtful design improvements.

This skill applies whenever you design, modify, review, or implement a user interface, user experience, component, page, dashboard, form, modal, navigation pattern, responsive layout, animation, or empty/loading/error state in this repository.

## Product context

School LN CM is a multi-tenant curriculum-driven lesson planning and school management platform. The first pilot is Future Speakers International School (FSIS), with Primary 5 First Term as the initial academic target.

Core users include:

- School administrators
- Teachers
- Future academic staff and school operators

The product should make school work feel organised, calm, fast, trustworthy, and easy to understand. Do not design it like a generic startup dashboard, banking app, social network, or developer tool.

## Non-negotiable design principles

1. **Product consistency over novelty.** Reuse established patterns before introducing a new visual or interaction pattern.
2. **Clarity over decoration.** Every visual element must help the user understand, decide, navigate, or act.
3. **Workflow first.** Design around real school tasks: preparing lessons, reviewing curriculum, managing staff, checking academic progress, and organising teaching work.
4. **Progressive disclosure.** Show the important information first and reveal secondary detail when needed.
5. **Calm density.** School administrators need useful information at a glance, but the interface must never become visually noisy.
6. **Mobile is a first-class surface.** Teachers may use phones in classrooms. Responsive behaviour must be designed, not merely shrink desktop layouts.
7. **Accessible by default.** Keyboard navigation, readable contrast, visible focus states, semantic structure, labels, touch targets, and screen-reader clarity are part of the design, not polish.
8. **Trustworthy actions.** Destructive, irreversible, permission-sensitive, or data-changing actions require clear language and appropriate confirmation.
9. **Real states matter.** Every meaningful screen should account for loading, empty, success, error, disabled, permission-restricted, and partial-data states where applicable.
10. **Never invent product behaviour to make a screen look complete.** If the backend capability does not exist, represent the state honestly.

## Visual direction

The visual language should be modern, premium, warm, academic, and operationally clear.

Use:

- Strong typographic hierarchy
- Generous but purposeful spacing
- Restrained surfaces and borders
- Clear primary actions
- Subtle elevation only where it improves hierarchy
- Consistent corner radii
- Quiet backgrounds that keep attention on content
- Small, purposeful motion
- Clear status indicators
- Familiar form controls

Avoid:

- Excessive gradients
- Glassmorphism everywhere
- Neon or gaming aesthetics
- Huge decorative illustrations that compete with the task
- Excessive rounded cards
- Random icon styles
- Excessive shadows
- Tiny text used to fit more information
- Dashboard widgets that exist only to fill space
- Animations that delay or obstruct work

Do not introduce a new colour, font, radius, shadow, spacing scale, or icon treatment when an existing token or component can do the job.

## Source of truth

Before implementing UI, inspect the existing repository styles, components, routes, and documentation. The existing design system is the source of truth unless the task explicitly calls for a deliberate design-system change.

Prefer existing:

- CSS variables/design tokens
- Typography scale
- Button styles
- Input styles
- Card/surface patterns
- Navigation patterns
- Modal/dialog patterns
- Toast/alert patterns
- Status treatments
- Icon library
- Responsive breakpoints

If a required pattern does not exist, create it as a reusable primitive rather than solving it with a one-off page-specific style.

## Information architecture

Keep the product hierarchy understandable:

```text
School
  ├── Academic session
  │     ├── Term
  │     │     ├── Week
  │     │     │     └── Lesson
  │     │     └── Curriculum
  │     └── Classes
  │            └── Subjects
  ├── Staff
  │     └── Teacher assignments
  └── Administration
```

User interfaces should make this hierarchy visible through navigation, breadcrumbs, page titles, contextual selectors, and content grouping where appropriate.

Do not flatten unrelated concepts into one dashboard or hide important academic context behind unexplained controls.

## Authentication and onboarding UX

School LN CM uses email-based authentication for teachers/staff. Staff IDs such as `FSIS-T-0001` are internal school identifiers, not the normal login credential.

The expected teacher journey is:

```text
Admin adds teacher
→ invitation sent to email
→ teacher accepts invitation
→ teacher creates password
→ school membership becomes active
→ teacher enters workspace
```

Authentication screens must therefore:

- Ask for email where email is the identity credential.
- Clearly explain invitation and account-activation states.
- Never ask teachers to log in using a generated Staff ID unless a future product decision explicitly restores that behaviour.
- Provide clear success, expired, revoked, already-used, and invalid-invitation states.
- Avoid exposing tenant data before authentication and membership checks complete.

## Role-aware UX

Do not build one interface and merely hide a few buttons for different roles.

Design according to the user's responsibility:

### Administrator

Priorities:

- School overview
- Staff management
- Invitations
- Academic setup
- Curriculum configuration
- Assignments
- Operational visibility

### Teacher

Priorities:

- Today's lessons
- Upcoming teaching work
- Curriculum context
- Lesson-note creation and editing
- Saved lesson library
- Preparation progress
- Classroom workflow

Permissions must be reflected in both navigation and interaction states. A hidden button is not a substitute for server-side authorization.

## Page construction rules

Every major page should answer these questions quickly:

1. Where am I?
2. What am I looking at?
3. What matters most right now?
4. What can I do here?
5. What happens after I act?

Recommended structure:

```text
Global navigation
→ Context / breadcrumb where useful
→ Page title + concise purpose
→ Primary action
→ Main content hierarchy
→ Supporting information
→ Secondary actions
```

Do not put multiple competing primary actions in the same visual position.

## Forms

Forms should be short, clear, and forgiving.

Rules:

- Labels must remain visible; do not rely on placeholder text as the only label.
- Group related fields.
- Use appropriate input types.
- Explain constraints before the user submits when possible.
- Validate inline without producing noisy error messages.
- Preserve valid user input after validation errors.
- Disable submission only when there is a clear reason, and always show progress after submission begins.
- Never silently discard entered data.
- Use meaningful button labels such as `Send invitation`, `Save assignment`, or `Create lesson`, not vague labels such as `Submit`.

## Tables and academic data

School management data can become dense. Tables should prioritise scanability.

Use:

- Clear column hierarchy
- Sticky headers when useful
- Sort/filter controls when datasets justify them
- Pagination or progressive loading for large datasets
- Compact but readable row spacing
- Status badges with text, not colour alone
- Responsive alternatives for narrow screens

On mobile, do not force wide desktop tables into tiny unreadable columns. Convert them into stacked records, horizontally scroll only when justified, or provide a focused detail view.

## Lesson-note and curriculum UX

Curriculum-aware teaching is the product's core value. The interface should preserve context such as:

```text
Class → Subject → Term → Week → Unit/Topic → Lesson
```

When a teacher creates or edits a lesson note, that context should be visible and difficult to accidentally lose.

AI-generated content, when implemented, must be presented as editable working material rather than unquestionable truth. Make generation status, editable content, regeneration, saving, and version history understandable.

## Navigation

Navigation must reflect the user's mental model, not the database schema.

Good navigation labels are task-oriented and familiar. Avoid exposing internal implementation names such as table names, API concepts, or database terminology.

On desktop, persistent navigation may be used where it improves orientation. On mobile, navigation should collapse into a deliberate mobile pattern rather than simply overflowing.

Always preserve:

- Current location
- Active navigation state
- School context
- Session/term context where relevant

## Responsive behaviour

Design at minimum for:

- Small mobile phones
- Large phones/tablets
- Laptop/desktop
- Wide desktop screens

Do not simply reduce font sizes to make desktop fit mobile.

For every major component decide explicitly:

- What remains visible?
- What stacks?
- What collapses?
- What becomes a menu?
- What becomes horizontally scrollable?
- What changes from table to card/list?
- Which action remains primary?

Touch targets should be comfortably tappable and spaced to avoid accidental activation.

## Motion and interaction

Motion should communicate state or hierarchy.

Use subtle transitions for:

- Navigation changes
- Dialog appearance
- Expand/collapse
- Loading states
- Save/success feedback
- Reordering where applicable

Avoid:

- Long entrance animations
- Decorative continuous motion
- Parallax for ordinary school workflows
- Animation that blocks typing, saving, navigation, or classroom work

Respect reduced-motion preferences.

## Accessibility

Every implementation must consider:

- Semantic HTML
- Keyboard access
- Visible focus
- Colour contrast
- Form labels and descriptions
- Error association
- Screen-reader names for icon-only buttons
- Status messages that do not depend solely on colour
- Logical heading hierarchy
- Sufficient touch target size
- Reduced motion

Do not use colour as the only signal for success, warning, error, attendance, or academic status.

## Component architecture

Build reusable components when the pattern appears more than once or represents an important product primitive.

Prefer a structure such as:

```text
ui primitives
→ shared patterns
→ domain components
→ page compositions
```

Examples of likely shared patterns:

- App shell
- School switcher/context header
- Page header
- Button variants
- Form fields
- Selects
- Status badges
- Empty states
- Loading skeletons
- Confirmation dialogs
- Toasts
- Data tables
- Lesson cards
- Curriculum breadcrumbs

Do not create five slightly different versions of the same button, card, modal, or empty state.

## Content and microcopy

Use plain, human language.

Prefer:

- `Send invitation`
- `Invitation sent`
- `Create lesson note`
- `Save changes`
- `No teachers yet`
- `This invitation has expired`

Avoid:

- Technical error codes in primary user-facing copy
- Vague labels
- Internal database terminology
- Blaming the user
- Overly promotional language inside operational screens

Error messages should explain what happened and what the user can do next.

## Empty, loading, error, and success states

Never leave a blank area where the application is waiting for data.

Each important state should answer:

- What is happening?
- Is the user's data safe?
- Can they retry?
- Is there another useful action?

Examples:

```text
Loading teachers…

No teachers yet
Add your first teacher to begin building the staff directory.
[Add teacher]

Invitation expired
This invitation is no longer valid.
[Send new invitation]
```

## Data and security UX boundary

UI must never be treated as the security boundary.

Do not assume that hiding a control protects data. Tenant isolation, role checks, invitation ownership, and authorization belong to the server/database layer.

The UI should still communicate permission boundaries clearly, for example by:

- Hiding inaccessible navigation items when appropriate
- Showing read-only states where the user has view access but not edit access
- Providing useful permission-denied messages
- Avoiding links that knowingly lead to inaccessible resources

## Design review checklist

Before considering a UI task complete, verify:

### Product

- Does this solve a real school workflow?
- Is the user's role clear?
- Is school/academic context preserved?
- Is the primary action obvious?

### Visual

- Does it use the existing design language?
- Are spacing, typography, borders, radii, icons, and states consistent?
- Is the page visually balanced without unnecessary decoration?

### Interaction

- Are loading, empty, success, error, and disabled states handled?
- Are destructive actions protected?
- Are forms understandable and recoverable?

### Responsive

- Does the layout work on a phone?
- Does the primary task remain easy on mobile?
- Are dense tables/data handled appropriately?

### Accessibility

- Can the interface be operated with a keyboard?
- Are labels and focus states present?
- Is information conveyed without colour alone?
- Is reduced motion respected?

### Engineering

- Is an existing component reusable?
- Should this pattern become a shared component?
- Did the implementation introduce unnecessary dependencies?
- Did the UI invent behaviour that the backend does not support?

## Anti-drift rules

The following are explicit violations of this skill:

- Replacing the established visual language because a new design looks fashionable.
- Creating unrelated dashboard cards solely to make a page look richer.
- Introducing arbitrary colours, fonts, radii, shadows, or spacing values without a product reason.
- Changing authentication UX from email-based teacher identity back to Staff ID login without an explicit architectural decision.
- Designing screens around database tables instead of user tasks.
- Making desktop UI that is unusable on teacher phones.
- Treating animation as decoration rather than communication.
- Hiding functional problems behind polished UI.
- Using fake data or fake success states to make unfinished functionality appear complete.
- Ignoring existing repository patterns before creating new components.

## Implementation workflow

When asked to build or redesign a screen:

1. Inspect the relevant existing route, components, styles, and product documentation.
2. Identify the user role and primary task.
3. Identify the information hierarchy and required states.
4. Reuse existing design tokens/components wherever possible.
5. Define responsive behaviour before implementation.
6. Implement the smallest coherent reusable component structure.
7. Check loading, empty, error, success, disabled, and permission states.
8. Check keyboard/accessibility behaviour.
9. Review the screen against this skill before declaring it complete.

## Final rule

**School LN CM should look and behave like one carefully designed education product. Improve the interface when improvement is justified, but never drift from the product's established UX system just because a different pattern is visually interesting.**
