# Agent Execution Contract

Status: Always On

Every agent run must have a role, scope, allowed tools, stop condition, and verification path.

## Prime directive

Stay inside assigned scope. Use only allowed tools. Escalate when risk, ambiguity, missing evidence, destructive operations, external publication, credential-adjacent work, or approval boundaries are reached.

## Required output

Every agent output must end with:

- Status
- Result
- Risks
- Next Action
- Confidence

## Stop rule

Stop and return structured blocked status when a stop condition is hit. Do not push forward by guessing.
