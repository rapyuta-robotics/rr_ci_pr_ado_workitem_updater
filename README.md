# PR ADO Work Item Updater

A GitHub Action that automatically updates Azure DevOps (ADO) work item states based on PR lifecycle events, and links work items to ADO Release work items when PRs are merged into release or devel branches.

## Features

### Work Item State Management

When a PR event occurs, the action reads the `AB#<id>` tag from the PR body to identify the linked ADO work item, then transitions it:

| PR Event | Work Item Transition |
|----------|---------------------|
| Opened   | &rarr; In Progress  |
| Merged   | &rarr; Closed/Done  |
| Closed (not merged) | &rarr; Open |

- Supports **Story** and **Task** work item types for state transitions.
- For Tasks, the parent Story is validated (must have a Story parent).
- Feature and Release work item types are accepted but state transitions are skipped.

### Release Work Item Linking

When a PR is merged into a **release branch** (`release/X.Y`) or the **devel branch**, the action automatically:

1. **Calculates the next version** from git tags via the GitHub API (no repo checkout needed):
   - **Release branch** (`release/X.Y`): Finds the latest tag matching `X.Y.*`, then calculates the next RC version (e.g., `1.2.3-rc2`). If no tags exist for that branch, starts at `X.Y.0-rc0`.
   - **Devel branch**: Finds the latest tag across all versions, then bumps the minor version (e.g., latest is `1.2.3` &rarr; next is `1.3.0`). If no tags exist at all, logs a warning and skips linking.

2. **Finds or creates** the ADO Release work item with the title format `[<repo_name>] <version>` (e.g., `[rr_oks] 1.2.3-rc1`). If the Release work item doesn't exist, it is created automatically.

3. **Links** the work item to the Release using a `Related` link. For Tasks, the parent Story is linked instead. Duplicate links are detected and skipped.

Release linking failures are handled gracefully and do not fail the overall action.

#### Version Calculation Logic

The version calculation mirrors the logic in `version_increment.sh`:

- Tags are parsed as semver: `X.Y.Z` (release) or `X.Y.Z-rcN` (release candidate), with optional `v` prefix.
- A weighted comparison ensures correct ordering: release `1.2.3` > RC `1.2.3-rc99`, and RC `1.2.4-rc0` > release `1.2.3`.
- For release branches, the next version is always an RC (increment RC number, or bump patch and start `rc0` if latest was a release).
- For devel, the next version bumps the minor and resets patch to 0 (e.g., `X.(Y+1).0`).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `gh_token` | Yes | GitHub personal access token for API access |
| `ado_token` | Yes | Azure DevOps personal access token |
| `ado_organization` | Yes | ADO organization name |
| `ado_project` | Yes | ADO project name |
| `closedstate` | Yes | ADO state to set when PR is merged (e.g., `Done`) |
| `propenstate` | Yes | ADO state to set when PR is opened (e.g., `Ready`) |
| `inprogressstate` | Yes | ADO state to set when PR is in progress (e.g., `In Progress`) |
| `ghrepo_owner` | Yes | GitHub repository owner |
| `ghrepo` | Yes | GitHub repository name (also used as the component name in Release titles) |
| `pull_number` | Yes | PR number from the GitHub event |
| `branch_name` | Yes | Branch name from the GitHub event |
| `devel_branch` | No | Name of the development branch (defaults to `devel`) |

## Sample Workflow

```yml
name: Update ADO work items on PR events

on:
  pull_request:
    branches: [devel, 'release/**']
    types: [opened, closed, edited]

jobs:
  update-work-item:
    runs-on: ubuntu-latest
    name: Update ADO work item
    steps:
    - uses: rapyuta-robotics/rr_ci_pr_ado_workitem_updater@release_wit_updater
      env:
        gh_token: '${{ secrets.GH_TOKEN }}'
        ado_token: '${{ secrets.ADO_PERSONAL_ACCESS_TOKEN }}'
        ado_organization: '${{ secrets.ADO_ORGANIZATION }}'
        ado_project: '${{ secrets.ADO_PROJECT }}'
        closedstate: 'Done'
        propenstate: 'Ready'
        inprogressstate: 'In Progress'
        ghrepo_owner: '${{ github.repository_owner }}'
        ghrepo: '${{ github.event.repository.name }}'
        pull_number: '${{ github.event.number }}'
        branch_name: '${{ github.ref }}'
```

## Running Tests

```bash
npm test
```

Tests cover semver parsing, version weight calculation, next-version calculation (release branches and devel), branch detection, and PR body parsing. Tests that require live API tokens (GitHub/ADO) will fail locally without credentials configured.
