export type ProjectType = "node" | "python" | "rust" | "go" | "unknown";

export function detectProjectType(files: string[]): ProjectType {
  if (files.includes("package.json")) return "node";
  if (files.includes("requirements.txt") || files.includes("pyproject.toml")) return "python";
  if (files.includes("Cargo.toml")) return "rust";
  if (files.includes("go.mod")) return "go";
  return "unknown";
}
