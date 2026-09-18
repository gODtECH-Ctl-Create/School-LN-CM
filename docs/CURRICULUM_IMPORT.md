# Curriculum import

School LN CM supports structured JSON imports for curriculum plans. Imports are intentionally separate from lesson generation.

## Source rule

Every import must identify its source. For the FSIS Primary 5 pilot, prefer an approved NERDC or school-authorized scheme of work and keep the source reference with the imported curriculum.

Official starting points:

- NERDC revised Basic Education Curriculum: https://www.nerdc.gov.ng/content_manager/new_curriculum_home.html
- NERDC Primary 5 curriculum portal: https://lmis.nerdcportals.com.ng/pry_5

Do not label a week-by-week plan as an official NERDC scheme unless that exact sequencing is present in the approved source. A school-developed scheme can still be imported, but its source name should identify the school or document accurately.

## Import behavior

- Imports always create or update **draft** curricula.
- Published and archived curricula are protected from replacement.
- Existing draft curricula are protected unless the caller explicitly sets `replaceExisting: true`.
- Every subject import must contain the exact number of topic slots declared by `weekCount × topicsPerWeek`.
- Subjects are matched to the school first by `subjectCode`, then by case-insensitive `subjectName`.
- Source metadata is stored on each curriculum for auditability.
- Administrators review and publish imported curricula through the normal curriculum workflow.

## Endpoint

`POST /api/admin/curriculum/import`

Request wrapper:

```json
{
  "schoolId": "uuid",
  "sessionId": "uuid",
  "termId": "uuid",
  "classId": "uuid",
  "replaceExisting": false,
  "manifest": {}
}
```

The JSON file itself is portable and does not contain school database IDs. See `docs/examples/curriculum-import.example.json`.

## Manifest schema

```json
{
  "schemaVersion": 1,
  "source": {
    "name": "Approved curriculum or scheme name",
    "url": "https://example.org/source",
    "reference": "Document edition/page/reference",
    "checkedAt": "2026-09-18"
  },
  "subjects": [
    {
      "subjectName": "Mathematics",
      "subjectCode": "MTH",
      "weekCount": 2,
      "topicsPerWeek": 1,
      "topics": [
        { "weekNumber": 1, "topicNumber": 1, "title": "Illustrative topic one" },
        { "weekNumber": 2, "topicNumber": 1, "title": "Illustrative topic two" }
      ]
    }
  ]
}
```

The example topics above are placeholders only; they are not represented as official NERDC Primary 5 content.
