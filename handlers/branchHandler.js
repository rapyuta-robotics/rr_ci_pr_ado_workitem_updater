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

    console.log(gitHubBranchUrls);

    let patchDocument = [
        {
            op: "add",
            path: "/fields/System.State",
            value: process.env.inprogressstate
        }
    ];

    await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);

    if (gitHubBranchUrls === undefined || 
        gitHubBranchUrls.includes("https://github.com/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/tree/"+process.env.branch_name+"\n") == false) {
        patchDocument = [
            {
                op: "add",
                path: "/fields/Custom.GitHubbranchURLs",
                value: gitHubBranchUrls + "<div><a href=\""+"https://github.com/"+process.env.ghrepo_owner+"/"+process.env.ghrepo+"/tree/"+process.env.branch_name+""+"\">"+process.env.ghrepo+" - "+process.env.branch_name+"</a></div>"
            }
        ]

        await azureDevOpsHandler.updateWorkItem(patchDocument, workItemId);
    }

    return true;
}
exports.handleOpenedBranch = handleOpenedBranch;