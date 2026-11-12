export interface DockerRunOptions {
  image: string;
  command: string[];
  workDir: string;
}

export class DockerSandbox {
  async runInContainer(options: DockerRunOptions): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    // Docker execution runner stub
    return { exitCode: 0, stdout: "", stderr: "" };
  }
}
