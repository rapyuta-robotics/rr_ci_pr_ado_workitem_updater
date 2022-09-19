const azureDevOpsHandler = require('azure-devops-node-api');

async function getAzureDevOpsClient(){
    let authHandler = azureDevOpsHandler.getPersonalAccessTokenHandler(process.env.ado_token);
    let connection = new azureDevOpsHandler.WebApi("https://dev.azure.com/" + process.env.ado_organization, authHandler);
    let client = await connection.getWorkItemTrackingApi();

    return client;
}

async function getWorkItem(workItemId) {
    var azureDevOpsClient = await getAzureDevOpsClient();

    return await azureDevOpsClient.getWorkItem(workItemId);
}
exports.getWorkItem = getWorkItem

async function updateWorkItem(patchDocument, workItemId) {
    var azureDevOpsClient = await getAzureDevOpsClient();

    await azureDevOpsClient.updateWorkItem(
        (customHeaders = []),
        (document = patchDocument),
        (id = workItemId),
        (project = process.env.project),
        (validateOnly = false)
    );
}
exports.updateWorkItem = updateWorkItem;