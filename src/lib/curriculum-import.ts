export type CurriculumImportTopic = {
  weekNumber: number;
  topicNumber: number;
  title: string;
  summary?: string;
};

export type CurriculumImportSubject = {
  subjectName: string;
  subjectCode?: string;
  title?: string;
  description?: string;
  weekCount: number;
  topicsPerWeek: number;
  topics: CurriculumImportTopic[];
};

export type CurriculumImportManifest = {
  schemaVersion: 1;
  source: {
    name: string;
    url?: string;
    reference?: string;
    checkedAt?: string;
  };
  subjects: CurriculumImportSubject[];
};

type ValidationResult =
  | { ok: true; value: CurriculumImportManifest }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function validateCurriculumImportManifest(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, error: "Import file must contain a JSON object." };
  if (input.schemaVersion !== 1) return { ok: false, error: "Unsupported curriculum import schema version." };
  if (!isRecord(input.source)) return { ok: false, error: "Curriculum source metadata is required." };

  const sourceName = text(input.source.name);
  const sourceUrl = text(input.source.url);
  const sourceReference = text(input.source.reference);
  const sourceCheckedAt = text(input.source.checkedAt);

  if (sourceName.length < 2 || sourceName.length > 160) {
    return { ok: false, error: "Source name must be between 2 and 160 characters." };
  }

  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    } catch {
      return { ok: false, error: "Source URL must be a valid HTTP or HTTPS URL." };
    }
  }

  if (sourceCheckedAt && Number.isNaN(Date.parse(sourceCheckedAt))) {
    return { ok: false, error: "Source checkedAt must be a valid date or timestamp." };
  }

  if (!Array.isArray(input.subjects) || !input.subjects.length) {
    return { ok: false, error: "Import at least one subject." };
  }

  const subjects: CurriculumImportSubject[] = [];
  const subjectKeys = new Set<string>();

  for (const rawSubject of input.subjects) {
    if (!isRecord(rawSubject)) return { ok: false, error: "Every subject must be a JSON object." };

    const subjectName = text(rawSubject.subjectName);
    const subjectCode = text(rawSubject.subjectCode);
    const title = text(rawSubject.title);
    const description = text(rawSubject.description);
    const weekCount = integer(rawSubject.weekCount);
    const topicsPerWeek = integer(rawSubject.topicsPerWeek);

    if (subjectName.length < 2 || subjectName.length > 120) {
      return { ok: false, error: "Every subject needs a valid subjectName." };
    }
    if (subjectCode && subjectCode.length > 12) {
      return { ok: false, error: `Subject code for ${subjectName} is too long.` };
    }
    if (weekCount === null || weekCount < 1 || weekCount > 52) {
      return { ok: false, error: `${subjectName}: weekCount must be between 1 and 52.` };
    }
    if (topicsPerWeek === null || topicsPerWeek < 1 || topicsPerWeek > 6) {
      return { ok: false, error: `${subjectName}: topicsPerWeek must be between 1 and 6.` };
    }
    if (!Array.isArray(rawSubject.topics)) {
      return { ok: false, error: `${subjectName}: topics must be an array.` };
    }

    const key = (subjectCode || subjectName).toLowerCase();
    if (subjectKeys.has(key)) return { ok: false, error: `Duplicate subject in import: ${subjectName}.` };
    subjectKeys.add(key);

    const expected = weekCount * topicsPerWeek;
    if (rawSubject.topics.length !== expected) {
      return {
        ok: false,
        error: `${subjectName}: expected ${expected} topic slots but received ${rawSubject.topics.length}.`,
      };
    }

    const slots = new Set<string>();
    const topics: CurriculumImportTopic[] = [];

    for (const rawTopic of rawSubject.topics) {
      if (!isRecord(rawTopic)) return { ok: false, error: `${subjectName}: every topic must be an object.` };
      const weekNumber = integer(rawTopic.weekNumber);
      const topicNumber = integer(rawTopic.topicNumber);
      const topicTitle = text(rawTopic.title);
      const summary = text(rawTopic.summary);

      if (weekNumber === null || weekNumber < 1 || weekNumber > weekCount) {
        return { ok: false, error: `${subjectName}: topic weekNumber is outside the configured term.` };
      }
      if (topicNumber === null || topicNumber < 1 || topicNumber > topicsPerWeek) {
        return { ok: false, error: `${subjectName}: topicNumber is outside the configured weekly slots.` };
      }
      if (topicTitle.length < 2 || topicTitle.length > 240) {
        return { ok: false, error: `${subjectName}: every topic needs a title between 2 and 240 characters.` };
      }

      const slot = `${weekNumber}-${topicNumber}`;
      if (slots.has(slot)) return { ok: false, error: `${subjectName}: duplicate topic slot ${slot}.` };
      slots.add(slot);
      topics.push({ weekNumber, topicNumber, title: topicTitle, ...(summary ? { summary } : {}) });
    }

    subjects.push({
      subjectName,
      ...(subjectCode ? { subjectCode } : {}),
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      weekCount,
      topicsPerWeek,
      topics,
    });
  }

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      source: {
        name: sourceName,
        ...(sourceUrl ? { url: sourceUrl } : {}),
        ...(sourceReference ? { reference: sourceReference } : {}),
        ...(sourceCheckedAt ? { checkedAt: sourceCheckedAt } : {}),
      },
      subjects,
    },
  };
}
