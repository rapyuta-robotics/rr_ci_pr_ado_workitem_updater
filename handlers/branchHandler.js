const core = require("@actions/core");

const azureDevOpsHandler = require('./azureDevOpsHandler');

function getBranchTitle() {
    return process.env.branch_name;
}
exports.getBranchTitle = getBranchTitle;

function getWorkItemIdFromBranchTitle(fullBranchName) {
    try {
        var foundMatches = fullBranchName.match(/AB#[(0-9)]*/g);
        var fullWorkItemId = foundMatches[0];
        var workItemidAlone = fullWorkItemId.match(/[0-9]*/g)[3];

        return workItemidAlone;
    } catch (err) {
        console.log ("Couldn't obtain work item Id from Branch title");
        core.setFailed(err.toString());
    }
}
exports.getWorkItemIdFromBranchTitle = getWorkItemIdFromBranchTitle;

async function handleOpenedBranch(workItemId) {
    var workItem = await azureDevOpsHandler.getWorkItem(workItemId);
    var gitHubBranchUrls = workItem.fields["Custom.GitHubbranchURLs"];
    var currentWorkItemState = workItem.fields["System.State"];

    if (currentWorkItemState === process.env.propenstate) {
        console.log("PR is already open on this branch, not moving to in progress")
    }
    else {
        let patchDocument = [
            {
                op: "add",
                path: "/fields/System.State",
                value: process.env.inprogressstate
            }
        ];

        await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);
    }

    var branchUrl = "https://github.com/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/tree/"+process.env.branch_name;
    var encodedBranchUrl = encodeURI(branchUrl);
    encodedBranchUrl = encodedBranchUrl.replace("#", "%23");
    console.log("GitHub Branch URL: " + encodedBranchUrl)

    if (gitHubBranchUrls === undefined || 
        gitHubBranchUrls.includes(encodedBranchUrl) == false) {
        patchDocument = [
            {
                op: "add",
                path: "/fields/Custom.GitHubbranchURLs",
                value: gitHubBranchUrls + "<div><a href=\""+encodedBranchUrl+"\">"+process.env.ghrepo+" - "+process.env.branch_name+"</a></div>"
            }
        ]

        await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);
    }
    else {
        console.log("GitHub branch already added to the task, skipping editing the section");
    }

    return true;
}
exports.handleOpenedBranch = handleOpenedBranch;