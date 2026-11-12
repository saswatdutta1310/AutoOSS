export async function runCli(): Promise<void> {
  console.log("AutoOSS CLI running...");
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error("Fatal CLI error:", err);
    process.exit(1);
  });
}
