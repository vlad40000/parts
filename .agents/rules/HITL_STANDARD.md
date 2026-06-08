# Human-in-the-Loop Standard

Status: Always On

Human approval is required before:

- destructive or irreversible data changes
- production database migrations or writes
- publishing, deployment, or external side effects
- using credentials or authenticated supplier sessions
- accepting an ambiguous manufacturer or model identity
- resolving source conflicts without deterministic evidence
- promoting data whose required evidence is missing

When approval is required, stop at a reviewable checkpoint. Record the decision,
the evidence presented, the approver response, and the next permitted action in
workflow state.

Approval does not permit fabricated values or bypass the pricing-source and BOM
verification policies.
