# School LN CM design system

## Product feel

School LN CM should feel calm, capable, academic and trustworthy. The interface is operational software for schools, not a marketing site. Visual energy comes from typography, hierarchy, useful data and confident actions rather than decoration.

## Foundations

### Colour roles

Use semantic roles rather than one-off colours:

- **Ink**: primary text and headings.
- **Muted**: supporting text and metadata.
- **Canvas**: page background.
- **Surface**: cards, forms and navigation.
- **Primary**: the main action and active navigation state.
- **Primary-soft**: contextual highlights and selected surfaces.
- **Success**: completed/healthy states.
- **Warning**: attention states.
- **Danger**: destructive/error states.

### Type

Use a clean system sans-serif stack. Headings are compact and confident. Body copy stays readable at normal mobile sizes. Labels remain visible and never depend on placeholder text.

### Spacing

Use an 8px rhythm with smaller 4px steps where needed. Prefer fewer, more intentional gaps over many tiny adjustments.

### Shape

- Controls: 10–12px radius.
- Content surfaces: 16–20px radius.
- Large application shells: 22–26px radius.
- Pills/statuses: full radius.

### Elevation

Use borders first. Shadows are reserved for elevated shells, menus and transient surfaces. Avoid floating every section.

## Layout

Desktop application surfaces use a two-part shell:

```text
sidebar | content
```

The sidebar carries product identity, school context and navigation. The content area carries the current task, page heading and supporting context.

On mobile:

```text
header
content
bottom navigation / compact menu
```

Do not shrink the desktop sidebar into an unusable strip.

## Navigation model

### Administrator

- Overview
- Staff
- Academic setup
- Curriculum
- Settings

### Teacher

- Today
- My lessons
- Curriculum
- Lesson library
- Progress

Navigation labels should describe the job a user is doing, not a database table.

## Page header

A major page should normally contain:

1. Breadcrumb or context when useful.
2. Eyebrow for the product area.
3. Clear title.
4. One-sentence purpose.
5. One primary action.

## Dashboard cards

Cards should represent useful information, not decoration. A card should answer a real question such as:

- What do I teach today?
- How much preparation is left?
- Which invitations are pending?
- What academic period am I working in?

Avoid KPI walls and meaningless percentages.

## Forms

Forms use persistent labels, clear grouping, generous touch targets and helpful inline feedback. Primary action labels describe the result: `Send invitation`, `Save changes`, `Create lesson note`.

## Status

Statuses combine a readable text label with a semantic visual treatment. Colour is never the only signal.

## Motion

Use 150–220ms transitions for hover/focus/expand behaviour. Respect `prefers-reduced-motion` and never make a teacher wait for decorative animation.

## Accessibility baseline

- Visible keyboard focus.
- Semantic headings and landmarks.
- Inputs associated with visible labels.
- Minimum comfortable touch target around 44px.
- Error/success text is explicit, not colour-only.
- Icon-only controls have accessible names.
- Reduced-motion preference is respected.

## Component priorities

The first shared primitives should be:

```text
AppShell
PageHeader
Button
InputField
SelectField
StatusBadge
StatCard
LessonCard
EmptyState
```

Domain components should compose these primitives rather than introducing new visual conventions.

## UI review rule

Before shipping a new screen, compare it against this document and `.agents/skills/ui-ux/SKILL.md`. A visually attractive screen that breaks the system is still a failed implementation.
