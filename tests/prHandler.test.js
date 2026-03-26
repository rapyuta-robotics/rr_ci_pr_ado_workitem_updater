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

// parseSemverTag tests
test('parseSemverTag parses release tag "1.2.3"', () => {
    expect(prhandler.parseSemverTag("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, rc: null });
});

test('parseSemverTag parses RC tag "1.2.3-rc0"', () => {
    expect(prhandler.parseSemverTag("1.2.3-rc0")).toEqual({ major: 1, minor: 2, patch: 3, rc: 0 });
});

test('parseSemverTag parses RC tag "1.2.3-rc12"', () => {
    expect(prhandler.parseSemverTag("1.2.3-rc12")).toEqual({ major: 1, minor: 2, patch: 3, rc: 12 });
});

test('parseSemverTag parses tag with v prefix "v1.2.3"', () => {
    expect(prhandler.parseSemverTag("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, rc: null });
});

test('parseSemverTag parses tag with v prefix "v1.2.3-rc5"', () => {
    expect(prhandler.parseSemverTag("v1.2.3-rc5")).toEqual({ major: 1, minor: 2, patch: 3, rc: 5 });
});

test('parseSemverTag returns null for invalid tag "not-a-version"', () => {
    expect(prhandler.parseSemverTag("not-a-version")).toBeNull();
});

test('parseSemverTag returns null for two-part version "1.2"', () => {
    expect(prhandler.parseSemverTag("1.2")).toBeNull();
});

test('parseSemverTag returns null for tag with extra suffix "1.2.3-beta1"', () => {
    expect(prhandler.parseSemverTag("1.2.3-beta1")).toBeNull();
});

test('parseSemverTag parses zero versions "0.0.0"', () => {
    expect(prhandler.parseSemverTag("0.0.0")).toEqual({ major: 0, minor: 0, patch: 0, rc: null });
});

test('parseSemverTag parses large numbers "10.25.100-rc99"', () => {
    expect(prhandler.parseSemverTag("10.25.100-rc99")).toEqual({ major: 10, minor: 25, patch: 100, rc: 99 });
});

// calculateVersionWeight tests
test('calculateVersionWeight: release tag gets (patch+1)*1000 weight', () => {
    var weight = prhandler.calculateVersionWeight({ major: 1, minor: 2, patch: 3, rc: null });
    // 1*10^9 + 2*10^6 + (3+1)*10^3 = 1002004000
    expect(weight).toBe(1002004000);
});

test('calculateVersionWeight: RC tag gets patch*1000 + rc+1 weight', () => {
    var weight = prhandler.calculateVersionWeight({ major: 1, minor: 2, patch: 3, rc: 0 });
    // 1*10^9 + 2*10^6 + 3*10^3 + 0+1 = 1002003001
    expect(weight).toBe(1002003001);
});

test('calculateVersionWeight: release 1.2.3 > RC 1.2.3-rc99', () => {
    var releaseWeight = prhandler.calculateVersionWeight({ major: 1, minor: 2, patch: 3, rc: null });
    var rcWeight = prhandler.calculateVersionWeight({ major: 1, minor: 2, patch: 3, rc: 99 });
    expect(releaseWeight).toBeGreaterThan(rcWeight);
});

test('calculateVersionWeight: RC 1.2.4-rc0 > release 1.2.3', () => {
    var nextRcWeight = prhandler.calculateVersionWeight({ major: 1, minor: 2, patch: 4, rc: 0 });
    var prevReleaseWeight = prhandler.calculateVersionWeight({ major: 1, minor: 2, patch: 3, rc: null });
    expect(nextRcWeight).toBeGreaterThan(prevReleaseWeight);
});

test('calculateVersionWeight: RC 1.2.3-rc1 > RC 1.2.3-rc0', () => {
    var rc1 = prhandler.calculateVersionWeight({ major: 1, minor: 2, patch: 3, rc: 1 });
    var rc0 = prhandler.calculateVersionWeight({ major: 1, minor: 2, patch: 3, rc: 0 });
    expect(rc1).toBeGreaterThan(rc0);
});

// calculateNextVersion tests
test('calculateNextVersion: no matching tags returns X.Y.0-rc0', () => {
    var tags = ["2.0.0", "2.0.1-rc0"];
    expect(prhandler.calculateNextVersion(tags, "1.2")).toBe("1.2.0-rc0");
});

test('calculateNextVersion: empty tags array returns X.Y.0-rc0', () => {
    expect(prhandler.calculateNextVersion([], "1.2")).toBe("1.2.0-rc0");
});

test('calculateNextVersion: latest is RC, increments rc number', () => {
    var tags = ["1.2.0-rc0", "1.2.0-rc1"];
    expect(prhandler.calculateNextVersion(tags, "1.2")).toBe("1.2.0-rc2");
});

test('calculateNextVersion: latest is release, bumps patch and starts rc0', () => {
    var tags = ["1.2.0", "1.2.0-rc0", "1.2.0-rc1"];
    expect(prhandler.calculateNextVersion(tags, "1.2")).toBe("1.2.1-rc0");
});

test('calculateNextVersion: handles v-prefixed tags', () => {
    var tags = ["v1.2.0-rc0", "v1.2.0-rc1", "v1.2.0"];
    expect(prhandler.calculateNextVersion(tags, "1.2")).toBe("1.2.1-rc0");
});

test('calculateNextVersion: filters tags to matching branch version only', () => {
    var tags = ["1.2.0-rc0", "1.3.0-rc5", "2.0.0"];
    expect(prhandler.calculateNextVersion(tags, "1.2")).toBe("1.2.0-rc1");
});

test('calculateNextVersion: complex scenario with multiple releases and RCs', () => {
    var tags = ["1.2.0-rc0", "1.2.0-rc1", "1.2.0", "1.2.1-rc0", "1.2.1-rc1", "1.2.1"];
    expect(prhandler.calculateNextVersion(tags, "1.2")).toBe("1.2.2-rc0");
});

test('calculateNextVersion: returns null for null branchVersion', () => {
    expect(prhandler.calculateNextVersion(["1.2.0"], null)).toBeNull();
});

test('calculateNextVersion: returns null for undefined branchVersion', () => {
    expect(prhandler.calculateNextVersion(["1.2.0"], undefined)).toBeNull();
});

test('calculateNextVersion: returns null for empty branchVersion', () => {
    expect(prhandler.calculateNextVersion(["1.2.0"], "")).toBeNull();
});

test('calculateNextVersion: ignores non-semver tags', () => {
    var tags = ["1.2.0-rc0", "latest", "nightly-build", "1.2.foo"];
    expect(prhandler.calculateNextVersion(tags, "1.2")).toBe("1.2.0-rc1");
});

test('calculateNextVersion: single RC tag increments correctly', () => {
    var tags = ["1.2.0-rc0"];
    expect(prhandler.calculateNextVersion(tags, "1.2")).toBe("1.2.0-rc1");
});

test('calculateNextVersion: handles multi-digit versions', () => {
    var tags = ["10.25.3-rc7"];
    expect(prhandler.calculateNextVersion(tags, "10.25")).toBe("10.25.3-rc8");
});

// isDevelBranch tests
test('isDevelBranch returns true for "devel" by default', () => {
    delete process.env.devel_branch;
    expect(prhandler.isDevelBranch("devel")).toBe(true);
});

test('isDevelBranch returns false for non-devel branch', () => {
    delete process.env.devel_branch;
    expect(prhandler.isDevelBranch("main")).toBe(false);
});

test('isDevelBranch returns false for release branch', () => {
    delete process.env.devel_branch;
    expect(prhandler.isDevelBranch("release/1.2")).toBe(false);
});

test('isDevelBranch returns false for null', () => {
    expect(prhandler.isDevelBranch(null)).toBe(false);
});

test('isDevelBranch returns false for undefined', () => {
    expect(prhandler.isDevelBranch(undefined)).toBe(false);
});

test('isDevelBranch returns false for empty string', () => {
    expect(prhandler.isDevelBranch("")).toBe(false);
});

test('isDevelBranch respects devel_branch env var override', () => {
    process.env.devel_branch = "develop";
    expect(prhandler.isDevelBranch("develop")).toBe(true);
    expect(prhandler.isDevelBranch("devel")).toBe(false);
    delete process.env.devel_branch;
});

// calculateNextVersionFromDevel tests
test('calculateNextVersionFromDevel: bumps minor from latest release tag', () => {
    var tags = ["1.2.0", "1.2.1", "1.1.0"];
    expect(prhandler.calculateNextVersionFromDevel(tags)).toBe("1.3.0");
});

test('calculateNextVersionFromDevel: bumps minor from latest RC tag', () => {
    var tags = ["1.2.0", "1.3.0-rc2"];
    expect(prhandler.calculateNextVersionFromDevel(tags)).toBe("1.4.0");
});

test('calculateNextVersionFromDevel: picks highest across different majors', () => {
    var tags = ["1.9.0", "2.0.0-rc0"];
    // 2.0.0-rc0 weight: 2*10^9 + 0 + 0 + 1 = 2000000001
    // 1.9.0 weight: 1*10^9 + 9*10^6 + 1*10^3 = 1009001000
    // latest is 2.0.0-rc0, so next is 2.1.0
    expect(prhandler.calculateNextVersionFromDevel(tags)).toBe("2.1.0");
});

test('calculateNextVersionFromDevel: handles v-prefixed tags', () => {
    var tags = ["v1.2.3", "v1.2.4-rc1"];
    // 1.2.3 release weight: 1*10^9 + 2*10^6 + 4*10^3 = 1002004000
    // 1.2.4-rc1 weight: 1*10^9 + 2*10^6 + 4*10^3 + 2 = 1002004002
    // latest is 1.2.4-rc1, so next is 1.3.0
    expect(prhandler.calculateNextVersionFromDevel(tags)).toBe("1.3.0");
});

test('calculateNextVersionFromDevel: returns null for empty tags', () => {
    expect(prhandler.calculateNextVersionFromDevel([])).toBeNull();
});

test('calculateNextVersionFromDevel: returns null for no valid semver tags', () => {
    var tags = ["latest", "nightly", "not-a-version"];
    expect(prhandler.calculateNextVersionFromDevel(tags)).toBeNull();
});

test('calculateNextVersionFromDevel: ignores non-semver tags and uses valid ones', () => {
    var tags = ["latest", "1.5.2", "nightly"];
    expect(prhandler.calculateNextVersionFromDevel(tags)).toBe("1.6.0");
});

test('calculateNextVersionFromDevel: single tag 0.0.0 returns 0.1.0', () => {
    var tags = ["0.0.0"];
    expect(prhandler.calculateNextVersionFromDevel(tags)).toBe("0.1.0");
});

test('calculateNextVersionFromDevel: release outweighs same-version RC', () => {
    // 1.3.0 release > 1.3.0-rc5, so latest is 1.3.0, next is 1.4.0
    var tags = ["1.3.0-rc5", "1.3.0"];
    expect(prhandler.calculateNextVersionFromDevel(tags)).toBe("1.4.0");
});