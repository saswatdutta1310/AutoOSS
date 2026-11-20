export function makeBranchName(issueNumber, title) {
    const num = typeof issueNumber === "number" ? issueNumber : parseInt(issueNumber, 10);
    const safeNum = isNaN(num) || num <= 0 ? 0 : num;
    // Slugify title: lowercase, [a-z0-9-] only, collapse consecutive hyphens, trim hyphens
    let slug = (title || "")
        .toLowerCase()
        .normalize("NFKD") // normalize unicode
        .replace(/[^\x00-\x7F]/g, "") // strip non-ascii (including emoji/unicode accents)
        .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphen
        .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
    if (!slug) {
        slug = "fix";
    }
    // Max 40 chars for slug
    if (slug.length > 40) {
        slug = slug.substring(0, 40).replace(/-+$/, "");
    }
    if (!slug) {
        slug = "fix";
    }
    return `autooss/issue-${safeNum}-${slug}`;
}
