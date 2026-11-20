#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { runDoctor } from "./doctor.js";
import { createEventBus } from "./events.js";
import { SimpleGitOps } from "./github/git.js";
import { ingestIssue } from "./github/ingest.js";
import { OctokitGitHubClient } from "./github/octokit.js";
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
        }
        else if (res.status === "warn") {
            icon = "!";
        }
        console.log(`[${icon}] ${res.name}: ${res.detail}`);
    }
    console.log("");
    if (hasFailure) {
        console.error("Doctor check failed. Please resolve the errors above.");
        process.exit(1);
    }
    else {
        console.log("All critical doctor checks passed.");
    }
});
program
    .command("fix <issue-url>")
    .description("Fix a GitHub issue given its URL")
    .option("--dry-run", "Run in dry-run mode without pushing changes")
    .action(async (issueUrl, options) => {
    try {
        // 1. Verify GITHUB_TOKEN
        const config = loadConfig();
        if (!config.GITHUB_TOKEN) {
            console.error("Error: Missing GITHUB_TOKEN. Please configure it in your environment or run `autooss doctor`.");
            process.exit(1);
        }
        if (options.dryRun) {
            console.log("Notice: --dry-run flag enabled. Future push and PR creation steps will be skipped.");
        }
        const eventBus = createEventBus();
        eventBus.on("log", (payload) => {
            if (payload.level === "error") {
                console.error(`[LOG ERROR] ${payload.message}`);
            }
            else if (payload.level === "warn") {
                console.warn(`[LOG WARN] ${payload.message}`);
            }
        });
        const gitHubClient = new OctokitGitHubClient({ auth: config.GITHUB_TOKEN });
        const gitOps = new SimpleGitOps();
        console.log(`Ingesting issue: ${issueUrl}...`);
        const result = await ingestIssue({ gitHubClient, gitOps }, issueUrl, (event, payload) => eventBus.emit(event, payload));
        console.log("\nIssue Ingestion Summary:");
        console.log(`  Issue: ${result.issue.title} (#${result.issue.number})`);
        console.log(`  Workspace Path: ${result.repoPath}`);
        console.log(`  Working Branch: ${result.branch}`);
        if (result.contributing) {
            console.log("  Contributing Guide: Loaded");
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
    }
});
program.parse(process.argv);
