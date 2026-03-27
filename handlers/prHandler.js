const core = require("@actions/core");

const fetch = require("node-fetch");
const staticFunctions = require('../staticFunctions');
const azureDevOpsHandler = require('./azureDevOpsHandler');

async function getPrTitle() {
    try {
        const requestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+process.env.pull_number;

        const fetchResponse = await fetch(requestUrl, {
            method: 'GET',
            headers: staticFunctions.getRequestHeaders()
        });

        const jsonResponse = await fetchResponse.json();

        return jsonResponse.title;
    } catch (err) {
        console.log("Couldn't obtain PR title for PR number " + process.env.pull_number);
        core.setFailed(err.toString());
    }
}
exports.getPrTitle = getPrTitle;

async function getPrBody() {
    try {
        const requestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+process.env.pull_number;

        const fetchResponse = await fetch(requestUrl, {
            method: 'GET',
            headers: staticFunctions.getRequestHeaders()
        });

        const jsonResponse = await fetchResponse.json();

        return jsonResponse.body;
    } catch (err) {
        console.log("Couldn't obtain PR Body for PR number " + process.env.pull_number);
        core.setFailed(err.toString());
    }
}
exports.getPrBody = getPrBody;

async function getPrTargetBranch() {
    try {
        const requestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+process.env.pull_number;

        const fetchResponse = await fetch(requestUrl, {
            method: 'GET',
            headers: staticFunctions.getRequestHeaders()
        });

        if (!fetchResponse.ok) {
            console.log("Couldn't obtain PR target branch for PR number " + process.env.pull_number + ". HTTP status: " + fetchResponse.status);
            return null;
        }

        const jsonResponse = await fetchResponse.json();

        return jsonResponse.base && jsonResponse.base.ref ? jsonResponse.base.ref : null;
    } catch (err) {
        console.log("Couldn't obtain PR target branch for PR number " + process.env.pull_number);
        console.log(err.toString());
        return null;
    }
}
exports.getPrTargetBranch = getPrTargetBranch;

function getReleaseVersionFromBranch(branchName) {
    if (typeof branchName !== 'string' || branchName.length === 0) {
        return null;
    }
    var match = branchName.match(/^release\/(\d+\.\d+)$/);
    if (match) {
        return match[1];
    }
    return null;
}
exports.getReleaseVersionFromBranch = getReleaseVersionFromBranch;

/**
 * Fetch all tags from the GitHub repo via the REST API.
 * Returns an array of tag name strings (e.g. ["1.2.0", "1.2.1-rc0", "v1.2.1"]).
 * Uses pagination to collect all tags (GitHub returns max 100 per page).
 */
async function getRepoTags() {
    var tags = [];
    var page = 1;
    var perPage = 100;

    while (true) {
        var requestUrl = "https://api.github.com/repos/" + process.env.ghrepo_owner + "/" + process.env.ghrepo + "/tags?per_page=" + perPage + "&page=" + page;

        var fetchResponse = await fetch(requestUrl, {
            method: 'GET',
            headers: staticFunctions.getRequestHeaders()
        });

        if (!fetchResponse.ok) {
            console.log("WARNING: Could not fetch tags from GitHub API. HTTP status: " + fetchResponse.status);
            return [];
        }

        var jsonResponse = await fetchResponse.json();

        if (!Array.isArray(jsonResponse) || jsonResponse.length === 0) {
            break;
        }

        for (var i = 0; i < jsonResponse.length; i++) {
            tags.push(jsonResponse[i].name);
        }

        if (jsonResponse.length < perPage) {
            break;
        }

        page++;
    }

    return tags;
}
exports.getRepoTags = getRepoTags;

/**
 * Parse a semver tag string into its components.
 * Supports: "X.Y.Z", "X.Y.Z-rcN", "vX.Y.Z", "vX.Y.Z-rcN"
 * Returns { major, minor, patch, rc } or null if not a valid semver tag.
 * rc is null for release tags, or a number for RC tags.
 */
function parseSemverTag(tag) {
    var match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-rc(\d+))?$/);
    if (!match) {
        return null;
    }
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        rc: match[4] !== undefined ? parseInt(match[4], 10) : null
    };
}
exports.parseSemverTag = parseSemverTag;

/**
 * Calculate a numeric weight for a parsed semver version, matching the bash logic:
 * - For release tags (no rc): major*10^9 + minor*10^6 + (patch+1)*10^3
 * - For RC tags: major*10^9 + minor*10^6 + patch*10^3 + rc+1
 *
 * This ensures that a release tag X.Y.Z is always greater than X.Y.Z-rcN
 * (because (patch+1)*1000 > patch*1000 + rc+1 for any rc < 999).
 */
function calculateVersionWeight(parsed) {
    if (parsed.rc === null) {
        // Release version: extra weight on patch
        return parsed.major * 1e9 + parsed.minor * 1e6 + (parsed.patch + 1) * 1e3;
    } else {
        // RC version: weight on rc number
        return parsed.major * 1e9 + parsed.minor * 1e6 + parsed.patch * 1e3 + parsed.rc + 1;
    }
}
exports.calculateVersionWeight = calculateVersionWeight;

/**
 * Given a list of tag name strings and a branch version prefix (e.g. "1.2"),
 * calculate the next version string following the same logic as version_increment.sh.
 *
 * The update_type is always "rc" (release candidates) for this use case since
 * PRs merged to a release branch produce RC versions until a final release is cut.
 *
 * Returns a version string like "1.2.0-rc0" or "1.2.3-rc2", or null if branchVersion is invalid.
 */
function calculateNextVersion(allTags, branchVersion) {
    if (!branchVersion || typeof branchVersion !== 'string') {
        return null;
    }

    var branchPrefix = branchVersion + ".";

    // Filter tags that match the branch's X.Y.* pattern and are valid semver
    var matchingParsed = [];
    for (var i = 0; i < allTags.length; i++) {
        var tagName = allTags[i];
        // Strip leading 'v' for prefix matching (the bash script uses grep -F on "X.Y.")
        var stripped = tagName.replace(/^v/, '');
        if (stripped.indexOf(branchPrefix) !== 0) {
            continue;
        }
        var parsed = parseSemverTag(tagName);
        if (parsed !== null) {
            matchingParsed.push(parsed);
        }
    }

    // No matching tags: start at X.Y.0-rc0
    if (matchingParsed.length === 0) {
        return branchVersion + ".0-rc0";
    }

    // Find the latest tag by weight
    var latestWeight = -1;
    var latestParsed = null;
    for (var j = 0; j < matchingParsed.length; j++) {
        var weight = calculateVersionWeight(matchingParsed[j]);
        if (weight > latestWeight) {
            latestWeight = weight;
            latestParsed = matchingParsed[j];
        }
    }

    // Calculate the next RC version (update_type = "rc")
    if (latestParsed.rc === null) {
        // Latest was a release tag: bump patch, start rc0
        return latestParsed.major + "." + latestParsed.minor + "." + (latestParsed.patch + 1) + "-rc0";
    } else {
        // Latest was an RC tag: increment rc number
        return latestParsed.major + "." + latestParsed.minor + "." + latestParsed.patch + "-rc" + (latestParsed.rc + 1);
    }
}
exports.calculateNextVersion = calculateNextVersion;

/**
 * Check if a branch name is the development branch.
 * Defaults to "devel", but can be overridden via the DEVEL_BRANCH env var.
 */
function isDevelBranch(branchName) {
    if (typeof branchName !== 'string' || branchName.length === 0) {
        return false;
    }
    var develBranch = process.env.devel_branch || "devel";
    return branchName === develBranch;
}
exports.isDevelBranch = isDevelBranch;

/**
 * Given all repo tags, find the latest version across ALL branches/versions
 * and return X.(Y+1).0 as the next development version.
 *
 * This is used when a PR is merged into devel — the next version bumps minor
 * and resets patch to 0 (no RC suffix since this targets the next release line).
 *
 * Returns a version string like "1.3.0", or null if no valid semver tags exist.
 */
function calculateNextVersionFromDevel(allTags) {
    // Parse all valid semver tags
    var latestWeight = -1;
    var latestParsed = null;

    for (var i = 0; i < allTags.length; i++) {
        var parsed = parseSemverTag(allTags[i]);
        if (parsed === null) {
            continue;
        }
        var weight = calculateVersionWeight(parsed);
        if (weight > latestWeight) {
            latestWeight = weight;
            latestParsed = parsed;
        }
    }

    if (latestParsed === null) {
        return null;
    }

    return latestParsed.major + "." + (latestParsed.minor + 1) + ".0";
}
exports.calculateNextVersionFromDevel = calculateNextVersionFromDevel;

function getWorkItemIdFromPrTitle(fullPrBody) {
    try {
        var foundMatches = fullPrBody.match(/AB#[(0-9)]*/g);
        var fullWorkItemId = foundMatches[0];
        var workItemIdAlone = fullWorkItemId.match(/[0-9]*/g)[3];

        return workItemIdAlone;
    } catch (err) {
        console.log("Couldn't obtain work item ID from PR title");
        core.setFailed(err.toString());
    }
}
exports.getWorkItemIdFromPrTitle = getWorkItemIdFromPrTitle;

async function getParent(workItemId) {
    // Check if the Work item is a task and get the Parent ID
    var workItem = await azureDevOpsHandler.getWorkItem(workItemId);
    if (workItem.fields["System.WorkItemType"] === "Task") {
        var parentWorkItemId = workItem.fields["System.Parent"];
        if (parentWorkItemId === undefined) {
            // throw error for this case
            core.setFailed("Task is not a child of another task");
            return false;
        }
        else {
            console.log("Task is found to have a parent ID of: " + parentWorkItemId);
            return parentWorkItemId;
        }
    }
}
exports.getParent = getParent;

// Handling Open PRs, Azure DevOps Work Items should be in In Progress state and this only change if the state was in Open
async function handleOpenedPr(workItemId) {
    var workItem = await azureDevOpsHandler.getWorkItem(workItemId);
    var currentWorkItemState = workItem.fields["System.State"];

    if (currentWorkItemState !== process.env.closedstate) {
        let patchDocument = [
            {
                op: "add",
                path: "/fields/System.State",
                value: process.env.inprogressstate
            }
        ];
        await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);
    }
    return true;
}
exports.handleOpenedPr = handleOpenedPr;

// Handling Merged PRs, Azure DevOps Work Items should be in Closed state and this should only change if it was in In Progress
async function handleMergedPr(workItemId) {
    var workItem = await azureDevOpsHandler.getWorkItem(workItemId);
    var currentWorkItemState = workItem.fields["System.State"];

    if (currentWorkItemState === process.env.inprogressstate) {
        let patchDocument = [
            {
                op: "add",
                path: "/fields/System.State",
                value: process.env.closedstate
            }
        ];

        await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);
    }
    return true;
}
exports.handleMergedPr = handleMergedPr;

// Handling Closed PRs, Azure DevOps Work Items should be set back to In Progress if not already closed
async function handleClosedPr(workItemId) {
    var workItem = await azureDevOpsHandler.getWorkItem(workItemId);
    var currentWorkItemState = workItem.fields["System.State"];

    if (currentWorkItemState === process.env.inprogressstate) {
        let patchDocument = [
            {
                op: "add",
                path: "/fields/System.State",
                value: process.env.openstate
            }
        ];

        await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);
    }
    return true;
}
exports.handleClosedPr = handleClosedPr;

async function isPrOpen(pullRequestNumber) {
    var pullRequestStatus = await getPrState(pullRequestNumber);
    return pullRequestStatus === "open";
}
exports.isPrOpen = isPrOpen;

async function isPrMerged(pullRequestNumber) {
    var mergeStatus = await getMergeState(pullRequestNumber);
    return mergeStatus === 204;
}
exports.isPrMerged = isPrMerged;

async function isPrClosed(pullRequestNumber) {
    var pullRequestStatus = await getPrState(pullRequestNumber);
    return pullRequestStatus === "closed";
}
exports.isPrClosed = isPrClosed;

// private functions

async function getPrState(pullRequestNumber) {
    if (pullRequestNumber == null) {
        pullRequestNumber = process.env.pull_number;
    }

    const requestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+pullRequestNumber;
    var fetchResponse = await fetch (requestUrl, {
        method: 'GET',
        headers: staticFunctions.getRequestHeaders()
    });
    var jsonResponse = await fetchResponse.json();

    var pullRequestStatus = jsonResponse.state;
    return pullRequestStatus;
}

async function getMergeState(pullRequestNumber) {
    if (pullRequestNumber == null) {
        pullRequestNumber = process.env.pull_number;
    }

    const requestUrl = "https://api.github.com/repos/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/pulls/"+pullRequestNumber+"/merge";
    var fetchResponse = await fetch (requestUrl, {
        method: 'GET',
        headers: staticFunctions.getRequestHeaders()
    });

    return fetchResponse.status;
}
