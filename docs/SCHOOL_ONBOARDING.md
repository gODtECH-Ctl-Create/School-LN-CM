# School onboarding

School LN CM supports multiple schools. A new school owner should move from account creation to a usable school workspace without contacting an operator for normal setup.

## Entry

Login → Create a school account → email confirmation if required → School setup.

A signed-in user with no active school membership is routed to `/onboarding`.

## Setup steps

1. School: school name, short school code, optional school email.
2. Academic session: session name, start/end dates, current term.
3. Classes: class name plus section/level.
4. Subjects: tick system subjects and add school-specific custom subjects.

The system creates the three terms automatically from the session dates. The administrator can edit the term dates later under School setup.

## Completion

Finish setup creates:

- the school record;
- the first school administrator membership;
- the administrator profile;
- the current academic session;
- three terms;
- the entered classes;
- the selected system and custom subjects.

## UX rules

Onboarding is a short mobile wizard. One decision at a time. Do not expose database terms, membership records, or subscription concepts during setup.

A school administrator should reach a usable Home screen after the final step. Everything else is continued from People, Curriculum, or School setup.
