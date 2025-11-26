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
