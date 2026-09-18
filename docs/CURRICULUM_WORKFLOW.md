# Curriculum workflow

The curriculum builder has two simple stages: **Context** and **Curriculum**.

## 1. Context

The context is the source of truth for what is being planned. Values come from Academic Setup.

The administrator chooses:

1. Academic session.
2. Term for that session.
3. Section, derived from the school's class levels.
4. Class.
5. Subjects.

When the context changes, existing curricula for that exact session + term + class appear automatically. Do not create duplicates for subjects that already have a curriculum.

System subjects are available as checkboxes. Custom subjects can be added from the same screen and are stored as school-specific subjects.

## 2. Create Curriculum

The administrator ticks the subjects that do not already have a curriculum and clicks **Create Curriculum** once.

The system creates one curriculum record per subject under the selected context.

A curriculum is always scoped to:

- school;
- academic session;
- term;
- class;
- subject.

## 3. Curriculum

The Curriculum stage is subject-first. The administrator switches between the created subject curricula without repeating the context.

Each subject has its own settings:

- **Weeks:** 9, 10, 11 or 12.
- **Topics per week:** 1, 2, 3 or 4.

These settings belong to the selected subject curriculum. Changing Mathematics must not change English.

Once the settings are chosen, the builder creates the exact number of empty topic slots:

`weeks × topics per week`

For example:

`10 weeks × 2 topics = 20 topic slots`

The administrator then fills:

`Week 1 → Topic 1 → Topic 2`

`Week 2 → Topic 1 → Topic 2`

through the final week.

## Weekly topics

Each topic is stored with its week number and position within that week. Topic names are intentionally kept separate from lesson generation.

The curriculum builder does **not** generate lesson notes.

## Teacher handoff

The curriculum itself is the source for the later teaching workflow. Lesson-note generation remains a separate feature and should consume an existing subject curriculum rather than being mixed into curriculum setup.

## Mobile rule

The entire builder is phone first. Context controls stack compactly, subject tabs can scroll horizontally, and weekly topic inputs remain easy to scan and tap. Avoid desktop-style multi-panel editors and oversized controls.
