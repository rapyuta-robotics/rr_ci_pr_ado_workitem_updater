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

function getWorkItemIdFromPrTitle(fullPrTitle) {
    try {
        var foundMatches = fullPrTitle.match(/AB#[(0-9)]*/g);
        var fullWorkItemId = foundMatches[0];
        var workItemIdAlone = fullWorkItemId.match(/[0-9]*/g)[3];

        return workItemIdAlone;
    } catch (err) {
        console.log("Couldn't obtain work item ID from PR title");
        core.setFailed(err.toString());
    }
}
exports.getWorkItemIdFromPrTitle = getWorkItemIdFromPrTitle;

async function handleOpenedPr(workItemId) {
    let patchDocument = [
        {
            op: "add",
            path: "/fields/System.State",
            value: process.env.propenstate
        }
    ];

    await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);
    return true;
}
exports.handleOpenedPr = handleOpenedPr;

async function handleMergedPr(workItemId) {
    let patchDocument = [
        {
            op: "add",
            path: "/fields/System.State",
            value: process.env.closedstate
        }
    ];

    await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);
    return true;
}
exports.handleMergedPr = handleMergedPr;

async function handleClosedPr(workItemId) {
    let patchDocument = [
        {
            op: "add",
            path: "/fields/System.State",
            value: process.env.inprogressstate
        }
    ];

    await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);
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
