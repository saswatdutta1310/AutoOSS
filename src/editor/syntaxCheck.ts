export interface SyntaxCheckResult {
  valid: boolean;
  errors: string[];
}

export function checkSyntax(filePath: string, code: string): SyntaxCheckResult {
  // Syntax checker stub
  return { valid: true, errors: [] };
}
