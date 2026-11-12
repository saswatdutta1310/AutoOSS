export class FileSelector {
  selectRelevantFiles(query: string, availableFiles: string[]): string[] {
    // Rank or select files based on context/query
    return availableFiles.slice(0, 5);
  }
}
