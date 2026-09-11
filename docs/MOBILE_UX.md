# School LN CM Mobile UX

## Product priority

School LN CM is a mobile application first. Phone is the reference experience. Tablet expands the same interaction model. Desktop is a secondary presentation and must never define the information architecture.

## Reference sizes

Design and test every primary flow at 390 x 844 and 430 x 932. Verify the same flows at 768px and 820px wide tablet layouts.

## Navigation

Use a compact bottom navigation on phone and tablet. Keep the primary navigation to four destinations wherever possible. A Head Teacher may receive one additional Team destination, making five the maximum.

Admin: Home, People, Curriculum, School setup.

Teacher: Today, Lessons, Curriculum, Library.

Head Teacher: Teacher navigation plus Team.

Do not add Help, Settings, Notifications, Analytics, Reports, or other secondary areas to the primary navigation unless a real task requires them. Secondary actions belong inside the relevant page or account surface.

## Density

Prefer compact cards, short labels, and one clear action per section. Avoid oversized hero headings, large empty panels, decorative dashboard widgets, or three-column desktop layouts on phones.

Page headings should normally stay around 24–31px on phones. Body text should stay around 12–14px. Inputs and primary controls should remain touch friendly without becoming visually oversized.

## Touch

Interactive controls must have a comfortable touch target. Do not rely on tiny icon-only controls for primary actions. Destructive actions should remain visually secondary and should never compete with the main action.

## Context continuity

Never ask users to select the same school, academic session, term, class, or subject repeatedly when the system already knows the context.

Context should be inferred from the current school, current academic session, current term, teacher assignment, and the selected curriculum topic whenever possible.

The ideal teacher path is:

Curriculum -> Topic -> Prepare lesson -> Edit -> Save -> Publish.

The lesson editor should inherit class, subject, session, term, and topic from that path instead of making the teacher configure them again.

## Admin flow

The Admin should operate primarily through four tasks:

1. Manage People.
2. Set up the school once.
3. Create and publish curriculum.
4. See what needs attention from Home.

Adding a teacher should be a single flow: name, email, assignment, access level, send invitation.

Head Teacher is an access level on a teacher membership, not a separate application persona.

## Teacher flow

The Teacher should primarily do four things:

1. See what to do today.
2. Prepare lessons.
3. Read the published curriculum.
4. Reuse saved lessons from the Library.

Generation, editing, saving, and publishing should happen inside the lesson workflow rather than moving the teacher between separate tools.

## Head Teacher flow

A Head Teacher inherits the normal Teacher experience and gains Team for lightweight monitoring. Team is for visibility, not administration. A Head Teacher should not see school setup or staff-management controls unless separately promoted to Admin.

## Responsive behavior

At phone and tablet widths:

- Hide the desktop sidebar.
- Show a compact sticky top bar.
- Show the fixed bottom navigation.
- Stack complex grids into one column where necessary.
- Keep important actions visible near the content they affect.
- Respect safe-area insets on modern phones.
- Prevent horizontal scrolling except for intentionally scrollable content.

At tablet widths, use more breathing room and two-column forms when they genuinely improve scanning. Do not reintroduce desktop-style navigation.

## Quality bar

A screen is not ready when it merely fits on a phone. It is ready when a teacher can complete the primary task without zooming, hunting for controls, repeating known context, or navigating through unrelated screens.

## Build verification

After every primary UX change, run the production build and verify the phone navigation, page shell, forms, and primary task flow before merging to main.
