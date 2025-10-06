const core = require("@actions/core");
const github = require("@actions/github");
const fetch = require("node-fetch");

const prHandler = require("./handlers/prHandler");
const branchHandler = require("./handlers/branchHandler");
const staticFunctions = require("./staticFunctions");
const azureDevOpsHandler = require("./handlers/azureDevOpsHandler");
const version = "2.0.5";
global.Headers = fetch.Headers;

main();
async function main(){
    try {
        console.log("VERSION " + version);

        staticFunctions.getValuesFromPayload(github.context.payload);

        // HANDLING PULL REQUESTS
        if (process.env.GITHUB_EVENT_NAME.includes("pull_request")){
            console.log ("PR event detected");

            var prName = await prHandler.getPrBody();

            if (prName === undefined) {
                console.log("Couldn't read PR name properly, ending checks");
                return;
            }

            var workItemId = prHandler.getWorkItemIdFromPrTitle(prName);

            // Check if the Linked work item is not either a Maintenance Story, Enabler Story, User Story, Task, or Feature
            var workItem = await azureDevOpsHandler.getWorkItem(workItemId);
            if (workItem.fields["System.WorkItemType"] === "Task" || workItem.fields["System.WorkItemType"] === "Maintenance Story"  || workItem.fields["System.WorkItemType"] === "Enabler Story"  || workItem.fields["System.WorkItemType"] === "User Story" || workItem.fields["System.WorkItemType"] === "Feature") {
                console.log("Linked work item is a Task, Story Type or Feature, continuing");
            }
            else {
                console.log("Linked work item is not a Task, Story Type or Feature, Exiting");
                // throw error for this case
                core.setFailed("Linked work item is not a Task, Story Type or Feature");
                return;
            }

            // Move the work item to the correct state
            try {
                if ((await prHandler.isPrOpen()) === true) {
                    console.log("PR was opened, so moving AB#"+workItemId+" to "+process.env.propenstate+" state");
                    await prHandler.handleOpenedPr(workItemId);
                }
                else if ((await prHandler.isPrMerged()) === true) {
                    console.log("PR was merged, so moving AB#"+workItemId+" to "+process.env.closedstate+" state");
                    await prHandler.handleMergedPr(workItemId);
                }
                else if ((await prHandler.isPrClosed()) === true) {
                    console.log("PR was closed without merging, so moving AB#"+workItemId+" to "+process.env.inprogressstate+ " state");
                    await prHandler.handleClosedPr(workItemId);
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