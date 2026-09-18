export type SubjectCatalogItem = {
  name: string;
  code: string;
  sections: string[];
};

export const SUBJECT_CATALOG: SubjectCatalogItem[] = [
  { name: "English Language", code: "ENG", sections: ["Primary", "JSS", "SSS"] },
  { name: "Mathematics", code: "MTH", sections: ["Primary", "JSS", "SSS"] },
  { name: "Basic Science", code: "BSC", sections: ["Primary", "JSS"] },
  { name: "Basic Technology", code: "BTE", sections: ["JSS"] },
  { name: "Social Studies", code: "SOS", sections: ["Primary", "JSS"] },
  { name: "Civic Education", code: "CIV", sections: ["Primary", "JSS", "SSS"] },
  { name: "Computer Studies", code: "ICT", sections: ["Primary", "JSS", "SSS"] },
  { name: "Agricultural Science", code: "AGR", sections: ["Primary", "JSS", "SSS"] },
  { name: "Business Studies", code: "BUS", sections: ["JSS", "SSS"] },
  { name: "Religious Studies", code: "REL", sections: ["Primary", "JSS", "SSS"] },
  { name: "Physical & Health Education", code: "PHE", sections: ["Primary", "JSS", "SSS"] },
  { name: "Geography", code: "GEO", sections: ["SSS"] },
  { name: "Economics", code: "ECO", sections: ["SSS"] },
  { name: "Government", code: "GOV", sections: ["SSS"] },
  { name: "Literature in English", code: "LIT", sections: ["SSS"] },
  { name: "Biology", code: "BIO", sections: ["SSS"] },
  { name: "Chemistry", code: "CHE", sections: ["SSS"] },
  { name: "Physics", code: "PHY", sections: ["SSS"] },
];

export function normalizeSection(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("primary")) return "Primary";
  if (normalized.includes("jss") || normalized.includes("junior")) return "JSS";
  if (normalized.includes("sss") || normalized.includes("senior")) return "SSS";
  return value?.trim() || "Other";
}
