export interface SemgrepFinding {
  checkId: string;
  path: string;
  line: number;
  message: string;
}

export class SemgrepScanner {
  async scan(directory: string): Promise<SemgrepFinding[]> {
    // Semgrep scanning placeholder
    return [];
  }
}
