const azureDevOpsHandler = require('azure-devops-node-api');

async function getAzureDevOpsClient(){
    let authHandler = azureDevOpsHandler.getPersonalAccessTokenHandler(process.env.ado_token);
    let connection = new azureDevOpsHandler.WebApi("https://dev.azure.com/" + process.env.ado_organization, authHandler);
    let client = await connection.getWorkItemTrackingApi();

    return client;
}

async function getWorkItem(workItemId) {
    var azureDevOpsClient = await getAzureDevOpsClient();
    return await azureDevOpsClient.getWorkItem(workItemId,undefined, undefined,"All");
}
exports.getWorkItem = getWorkItem

async function updateWorkItem(patchDocument, workItemId) {
    var azureDevOpsClient = await getAzureDevOpsClient();

    await azureDevOpsClient.updateWorkItem(
        (customHeaders = []),
        (document = patchDocument),
        (id = workItemId),
        (project = process.env.ado_project),
        (validateOnly = false)
    );
}
exports.updateWorkItem = updateWorkItem;

/**
 * Find a Release work item in ADO by its full title.
 * Title format: "[<repo_name>] X.Y.Z" or "[<repo_name>] X.Y.Z-rcN"
 * e.g. "[rr_oks] 1.2.3-rc1"
 *
 * Uses exact title matching to avoid false positives.
 * Returns the work item ID if exactly one match is found, or null otherwise.
 */
async function findReleaseWorkItem(releaseTitle) {
    var azureDevOpsClient = await getAzureDevOpsClient();

    var wiql = {
        query: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Release' AND [System.Title] = '" + releaseTitle.replace(/'/g, "''") + "' AND [System.TeamProject] = '" + process.env.ado_project + "'"
    };

    var result = await azureDevOpsClient.queryByWiql(wiql, { project: process.env.ado_project });

    if (result.workItems && result.workItems.length === 1) {
        return result.workItems[0].id;
    } else if (result.workItems && result.workItems.length > 1) {
        console.log("WARNING: Multiple Release work items found for title '" + releaseTitle + "'. Not linking to avoid selecting an incorrect Release.");
    }

    return null;
}
exports.findReleaseWorkItem = findReleaseWorkItem;

/**
 * Create a new Release work item in ADO.
 * Title format: "[<repo_name>] X.Y.Z-rcN"
 * Returns the ID of the newly created work item.
 */
async function createReleaseWorkItem(releaseTitle) {
    var azureDevOpsClient = await getAzureDevOpsClient();

    var patchDocument = [
        {
            op: "add",
            path: "/fields/System.Title",
            value: releaseTitle
        }
    ];

    var result = await azureDevOpsClient.createWorkItem(
        (customHeaders = []),
        (document = patchDocument),
        (project = process.env.ado_project),
        (type = "Release"),
        (validateOnly = false)
    );

    return result.id;
}
exports.createReleaseWorkItem = createReleaseWorkItem;

async function linkWorkItemToRelease(workItemId, releaseWorkItemId) {
    var releaseWorkItemUrl = "https://dev.azure.com/" + process.env.ado_organization + "/" + process.env.ado_project + "/_apis/wit/workItems/" + releaseWorkItemId;

    let patchDocument = [
        {
            op: "add",
            path: "/relations/-",
            value: {
                rel: "System.LinkTypes.Related",
                url: releaseWorkItemUrl,
                attributes: {
                    comment: "Automatically linked by CI when PR was merged into release branch"
                }
            }
        }
    ];

    await updateWorkItem(patchDocument, workItemId);
}
exports.linkWorkItemToRelease = linkWorkItemToRelease;