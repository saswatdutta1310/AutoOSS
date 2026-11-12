export interface RepoMapEntry {
  path: string;
  symbols: string[];
}

export class RepoMap {
  async generateMap(rootPath: string): Promise<RepoMapEntry[]> {
    // Generate repository symbol map
    return [];
  }
}
