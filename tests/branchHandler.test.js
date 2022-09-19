const branchhandler = require('../handlers/branchHandler');



test('Fetching branch name', () => {
    var branchName = branchhandler.getBranchTitle();
    expect(branchName).toBe(process.env.branch_name);
});

test('Getting work item ID from the branch name', () => {
    var workItemId = branchhandler.getWorkItemIdFromBranchTitle("task/AB#5795-testing_branch_names");
    expect(workItemId).toBe("5795");
});

test('Opened branch test', async () => {
        var updated = await branchhandler.handleOpenedBranch("5795");
    expect(updated).toBe(true);
});