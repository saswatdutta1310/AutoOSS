#!/usr/bin/env node
import { Command } from "commander";
import { runDoctor } from "./doctor.js";
import { InvalidIssueUrlError, parseIssueUrl } from "./github/issueParser.js";

const program = new Command();

program
  .name("autooss")
  .description("Autonomous AI agent for open-source issue fixing")
  .version("0.1.0");

program
  .command("doctor")
  .description("Check local environment requirements and configuration")
  .action(async () => {
    console.log("Running autooss environment doctor...\n");
    const results = await runDoctor();

    let hasFailure = false;

    for (const res of results) {
      let icon = "✓";
      if (res.status === "fail") {
        icon = "✗";
        hasFailure = true;
      } else if (res.status === "warn") {
        icon = "!";
      }

      console.log(`[${icon}] ${res.name}: ${res.detail}`);
    }

    console.log("");
    if (hasFailure) {
      console.error("Doctor check failed. Please resolve the errors above.");
      process.exit(1);
    } else {
      console.log("All critical doctor checks passed.");
    }
  });

program
  .command("fix <issue-url>")
  .description("Fix a GitHub issue given its URL")
  .option("--dry-run", "Run in dry-run mode without pushing changes")
  .action(async (issueUrl: string, options: { dryRun?: boolean }) => {
    try {
      const parsed = parseIssueUrl(issueUrl);
      console.log(`Target Issue: ${parsed.owner}/${parsed.repo}#${parsed.number}`);
      if (options.dryRun) {
        console.log("Mode: Dry run enabled");
      }
      console.log("Not implemented yet");
    } catch (err) {
      if (err instanceof InvalidIssueUrlError) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
      console.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
