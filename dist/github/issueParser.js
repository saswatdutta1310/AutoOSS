export class InvalidIssueUrlError extends Error {
    constructor(message) {
        super(message);
        this.name = "InvalidIssueUrlError";
        Object.setPrototypeOf(this, InvalidIssueUrlError.prototype);
    }
}
export function parseIssueUrl(url) {
    if (!url || typeof url !== "string") {
        throw new InvalidIssueUrlError("Issue URL must be a non-empty string");
    }
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new InvalidIssueUrlError(`Invalid URL format: ${url}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new InvalidIssueUrlError(`Invalid protocol "${parsed.protocol}": Only HTTP(S) URLs are supported`);
    }
    if (parsed.hostname !== "github.com") {
        throw new InvalidIssueUrlError(`Invalid host "${parsed.hostname}": Host must be exactly github.com`);
    }
    // Pathname format: /:owner/:repo/issues/:number
    const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
    if (segments.length < 4) {
        throw new InvalidIssueUrlError("URL path is missing required components (expected /:owner/:repo/issues/:number)");
    }
    const [owner, repo, type, numStr] = segments;
    if (type === "pull" || type === "pulls") {
        throw new InvalidIssueUrlError("Pull request URLs are not supported. Expected an issue URL.");
    }
    if (type !== "issues") {
        throw new InvalidIssueUrlError(`Invalid URL type segment "${type}": Expected "issues"`);
    }
    if (!/^\d+$/.test(numStr)) {
        throw new InvalidIssueUrlError(`Invalid issue number "${numStr}": Must be a positive integer`);
    }
    const issueNumber = parseInt(numStr, 10);
    if (issueNumber <= 0) {
        throw new InvalidIssueUrlError(`Invalid issue number "${numStr}": Issue number must be greater than zero`);
    }
    return {
        owner,
        repo,
        number: issueNumber,
    };
}
