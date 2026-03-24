const core = require("@actions/core");
const github = require("@actions/github");
const fetch = require("node-fetch");

const prHandler = require("./handlers/prHandler");
const branchHandler = require("./handlers/branchHandler");
const staticFunctions = require("./staticFunctions");
const azureDevOpsHandler = require("./handlers/azureDevOpsHandler");
const version = "2.1.0";
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
                core.setFailed("Couldn't read PR Body properly, ending checks");
                return;
            }

            var workItemId = prHandler.getWorkItemIdFromPrTitle(prName);
            var parentWorkItemId;
            var parentWorkItem;

            // Check if the Linked work item is not either a Maintenance Story, Enabler Story, User Story, Task, or Feature
            var workItem = await azureDevOpsHandler.getWorkItem(workItemId);
            if (workItem.fields["System.WorkItemType"] === "Story" || workItem.fields["System.WorkItemType"] === "Feature" || workItem.fields["System.WorkItemType"] === "Release") {
                console.log("Linked work item is a Release, Story or Feature, continuing");
            }
            else if (workItem.fields["System.WorkItemType"] === "Task") {
                parentWorkItemId = await prHandler.getParent(workItemId);
                parentWorkItem = await azureDevOpsHandler.getWorkItem(parentWorkItemId);
                if (parentWorkItem.fields["System.WorkItemType"] === "Story") {
                    console.log("Linked work item is a Task with a Story as a Parent, continuing");
                }
                else {
                    core.setFailed("Linked work item is a Task, but it's parent is not a Story, please add a Story as a parent to the Task");
                    return;
                }
            }
            else {
                // throw error for this case
                core.setFailed("Linked work item is not a Task, Story, Feature, or Release, please add the correct work item type to the PR");
                return;
            }

            // Move the work item to the correct state
            try {
                // ignore Feature for now TODO: add support for Feature States
                if (workItem.fields["System.WorkItemType"] === "Story" || workItem.fields["System.WorkItemType"] === "Task") {
                    if ((await prHandler.isPrOpen()) === true) {
                        console.log("PR was opened, so moving AB#" + workItemId + " to " + process.env.propenstate + " state");
                        await prHandler.handleOpenedPr(workItemId);
                    } else if ((await prHandler.isPrMerged()) === true) {
                        console.log("PR was merged, so moving AB#" + workItemId + " to " + process.env.closedstate + " state");
                        await prHandler.handleMergedPr(workItemId);
                    } else if ((await prHandler.isPrClosed()) === true) {
                        console.log("PR was closed without merging, so moving AB#" + workItemId + " to " + process.env.inprogressstate + " state");
                        await prHandler.handleClosedPr(workItemId);
                    }
                }
            } catch (err) {
                console.log("Couldn't update the work item");
                core.setFailed(err.toString());
            }

            // Link work item to Release when PR is merged into a release branch
            try {
                if ((await prHandler.isPrMerged()) === true) {
                    var targetBranch = await prHandler.getPrTargetBranch();
                    var releaseVersion = prHandler.getReleaseVersionFromBranch(targetBranch);

                    if (releaseVersion !== null) {
                        console.log("PR was merged into release branch: " + targetBranch + " (version " + releaseVersion + ")");

                        // Determine which work item to link to the release
                        // For Tasks, link the parent Story; for Stories, link directly; skip Feature/Release
                        var workItemToLink = null;
                        var workItemType = workItem.fields["System.WorkItemType"];

                        if (workItemType === "Story") {
                            workItemToLink = workItemId;
                        } else if (workItemType === "Task" && parentWorkItemId) {
                            workItemToLink = parentWorkItemId;
                            console.log("Linked work item is a Task, will link parent Story AB#" + parentWorkItemId + " to release instead");
                        } else if (workItemType === "Feature" || workItemType === "Release") {
                            console.log("Linked work item is a " + workItemType + ", skipping release linking");
                        }

                        if (workItemToLink !== null) {
                            var releaseWorkItemId = await azureDevOpsHandler.findReleaseWorkItem(releaseVersion);

                            if (releaseWorkItemId !== null) {
                                // Check if the link already exists to avoid duplicates
                                var itemToCheck = await azureDevOpsHandler.getWorkItem(workItemToLink);
                                var alreadyLinked = false;

                                if (itemToCheck.relations) {
                                    for (var i = 0; i < itemToCheck.relations.length; i++) {
                                        if (itemToCheck.relations[i].url && itemToCheck.relations[i].url.endsWith("/" + releaseWorkItemId)) {
                                            alreadyLinked = true;
                                            break;
                                        }
                                    }
                                }

                                if (alreadyLinked) {
                                    console.log("AB#" + workItemToLink + " is already linked to Release AB#" + releaseWorkItemId + ", skipping");
                                } else {
                                    console.log("Linking AB#" + workItemToLink + " to Release AB#" + releaseWorkItemId);
                                    await azureDevOpsHandler.linkWorkItemToRelease(workItemToLink, releaseWorkItemId);
                                    console.log("Successfully linked AB#" + workItemToLink + " to Release AB#" + releaseWorkItemId);
                                }
                            } else {
                                console.log("WARNING: Could not find a Release work item for version " + releaseVersion + " in ADO project " + process.env.ado_project);
                            }
                        }
                    }
                }
            } catch (err) {
                // Release linking failure should not fail the whole action - log warning but continue
                console.log("WARNING: Could not link work item to release: " + err.toString());
            }
        }

    } catch (err) {
        core.setFailed(err.toString());
    }
}