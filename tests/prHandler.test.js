const prhandler = require('../handlers/prHandler');


test('Fetching the work item number from PR title', () => {
    expect(prhandler.getWorkItemIdFromPrTitle("AB#8790 sending email notifications to participants about the event")).toBe("8790");
});

test('Getting PR Body', async () => {
    var prTitle = await prhandler.getPrBody();
    expect(prTitle).toBe("AB#8790 sending email notifications to participants about the event");
});

test('Is PR open?', async () => {
    var prOpen = await prhandler.isPrOpen(process.env.pull_number);
    expect(prOpen).toBe(false);
});

test('Is PR merged?', async () => {
    var prMerged = await prhandler.isPrMerged(process.env.pull_number);
    expect(prMerged).toBe(true);
});

test('Is PR closed?', async () => {
    var prClosed = await prhandler.isPrClosed(process.env.pull_number);
    expect(prClosed).toBe(true);
});

test('Handling opened PR', async () => {
    var workItemIdToTestOn = "5795";
    var updateDone = await prhandler.handleOpenedPr(workItemIdToTestOn);
    expect(updateDone).toBe(true);
});

test('Handling closed PR', async () => { 
    var workItemIdToTestOn = "5795";
    var updateDone = await prhandler.handleClosedPr(workItemIdToTestOn);
    expect(updateDone).toBe(true);
});

test('Handling merged PR', async () => {
    var workItemIdToTestOn = "5795";
    var updateDone = await prhandler.handleMergedPr(workItemIdToTestOn);
    expect(updateDone).toBe(true);
});

// Release branch detection tests
test('getReleaseVersionFromBranch returns version for valid release branch', () => {
    expect(prhandler.getReleaseVersionFromBranch("release/1.2")).toBe("1.2");
});

test('getReleaseVersionFromBranch returns version for multi-digit version', () => {
    expect(prhandler.getReleaseVersionFromBranch("release/10.25")).toBe("10.25");
});

test('getReleaseVersionFromBranch returns null for non-release branch', () => {
    expect(prhandler.getReleaseVersionFromBranch("devel")).toBeNull();
});

test('getReleaseVersionFromBranch returns null for feature branch', () => {
    expect(prhandler.getReleaseVersionFromBranch("feature/my-feature")).toBeNull();
});

test('getReleaseVersionFromBranch returns null for release branch with three-part version', () => {
    expect(prhandler.getReleaseVersionFromBranch("release/1.2.3")).toBeNull();
});

test('getReleaseVersionFromBranch returns null for branch with release prefix but no version', () => {
    expect(prhandler.getReleaseVersionFromBranch("release/")).toBeNull();
});

test('getReleaseVersionFromBranch returns null for branch with extra path segments', () => {
    expect(prhandler.getReleaseVersionFromBranch("release/1.2/hotfix")).toBeNull();
});

test('getReleaseVersionFromBranch returns null for undefined input', () => {
    expect(prhandler.getReleaseVersionFromBranch(undefined)).toBeNull();
});

test('getReleaseVersionFromBranch returns null for null input', () => {
    expect(prhandler.getReleaseVersionFromBranch(null)).toBeNull();
});

test('getReleaseVersionFromBranch returns null for empty string', () => {
    expect(prhandler.getReleaseVersionFromBranch("")).toBeNull();
});