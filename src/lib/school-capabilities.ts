export const SCHOOL_CAPABILITIES = [
  { id: "preschool", label: "Preschool", description: "Early learning classes" },
  { id: "nursery", label: "Nursery", description: "Nursery 1, 2, 3 or similar" },
  { id: "primary", label: "Primary", description: "Primary school classes" },
  { id: "secondary", label: "Secondary", description: "Junior and senior secondary classes" },
] as const;

export type SchoolCapability = (typeof SCHOOL_CAPABILITIES)[number]["id"];
