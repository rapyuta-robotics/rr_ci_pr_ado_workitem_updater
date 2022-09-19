const prhandler = require('../handlers/prHandler');


test('Fetching the work item number from PR title', () => {
    expect(prhandler.getWorkItemIdFromPrTitle("AB#8790 sending email notifications to participants about the event")).toBe("8790");
});

test('Getting PR title', async () => {
    var prTitle = await prhandler.getPrTitle();
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