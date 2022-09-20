const core = require("@actions/core");
const github = require("@actions/github");
const fetch = require("node-fetch");

const prHandler = require("./handlers/prHandler");
const branchHandler = require("./handlers/branchHandler");
const staticFunctions = require("./staticFunctions");
const version = "2.0.2";
global.Headers = fetch.Headers;

main();
async function main(){
    try {
        console.log("VERSION " + version);

        staticFunctions.getValuesFromPayload(github.context.payload);

        // HANDLING PULL REQUESTS
        if (process.env.GITHUB_EVENT_NAME.includes("pull_request")){
            console.log ("PR event detected");

            var prName = await prHandler.getPrTitle();

            if (prName === undefined) {
                console.log("Couldn't read PR name properly, ending checks");
                return;
            }

            if (prName.includes("Code cleanup") ||
                prName.includes("Swagger update")) {
                    console.log ("No checkups for the code cleanup or swagger update branches");
                    return;
            }

            var workItemId = prHandler.getWorkItemIdFromPrTitle(prName);

            try {
                if (prHandler.isPrOpen()) {
                    console.log("PR was opened, so moving AB#"+workItemId+" to "+process.env.propenstate+" state");
                    await prHandler.handleOpenedPr(workItemId);
                } else if (prHandler.isPrMerged()) {
                    console.log("PR was merged, so moving AB#"+workItemId+" to "+process.env.closedstate+" state");
                    await prHandler.handleMergedPr(workItemId);
                } else if (prHandler.isPrClosed()) {
                    console.log("PR was closed without merging, so moving AB#"+workItemId+" to "+process.env.inprogressstate+ " state");
                    await prHandler.handleClosedPr(workItemId);
                }
            } catch (err) {
                console.log("Couldn't update the work item");
                core.setFailed(err.toString());
            }
        }
        // HANDLING BRANCHES
        else 
        {
            console.log ("Branch event detected");

            var branchName = branchHandler.getBranchTitle();
            
            if (branchName.includes("code-cleanup") ||
                branchName.includes("swagger-update") ) {
                console.log ("No checkups for the code cleanup or swagger update branches");
                return;
            }

            var workItemId = branchHandler.getWorkItemIdFromBranchTitle(branchName);
            
            try {
                var updated = await branchHandler.handleOpenedBranch(workItemId);
                if (updated != true) {
                    console.log("Couldn't update the work item");
                }
            } catch (err) {
                console.log("Couldn't update the work item");
                core.setFailed(err.toString());
            }
        }

    } catch (err) {
        core.setFailed(err.toString());
    }
}