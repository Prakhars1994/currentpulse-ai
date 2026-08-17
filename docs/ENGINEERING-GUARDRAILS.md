# CurrentPulse engineering guardrails

These rules apply to every production change.

## Latest-state rule

Before changing code:
1. discover all local CurrentPulse Git worktrees;
2. fetch `origin/main`;
3. select only a clean/current production worktree;
4. never infer "latest" from the PowerShell prompt or folder name;
5. for exact changed-file checks, use `git status --porcelain=v1 -uall` so
   untracked directories expand to their real file paths.

Use `tools/find-currentpulse-production.ps1`.

## Recurring-defect rule

When any defect is found:
1. identify the root-cause pattern;
2. search the whole project for equivalent occurrences;
3. fix all materially equivalent occurrences in the same pass;
4. add/strengthen a regression test or executable guard;
5. record architectural ownership when duplication caused the defect.

A recurring defect is not considered solved if the prevention exists only in a
one-off ZIP or chat instruction.

## Single-source-of-truth rule

Production eligibility, scheduler ownership, source approval, limits and routing
must have one canonical definition where practical.

`lib/coverage/sourcePolicy.js` is the canonical Current Affairs source-approval policy.

## Timeout rule

Do not solve recurring timeouts by only increasing timeout values.

Heavy work must be bounded by source batches, queue batches, cursor pages,
per-source deadlines, or a global phase deadline. Unfinished work stays durable.

## AI availability rule

Source collection must not depend on AI availability. Collection persists durable
queue rows; bounded queue processing owns AI generation/publication.

## Installer rule

Installer/generator code must avoid nested template generation when a plain payload
file can be copied instead. Payload JavaScript/tests must pass `node --check`
before any project mutation.

## Quality rule

A successful automation request is not proof of a good public article. Source policy,
source evidence, publication safety and quality gates must all pass.
