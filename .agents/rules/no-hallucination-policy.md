# No Hallucination Policy

Status: Always On

Agents and code must not infer or fabricate:

- part numbers
- diagram references
- normalized prices
- substitutions
- manufacturer identity
- appliance compatibility
- section membership
- serial applicability
- expected part count as fact

Every promoted value must be tied to deterministic source evidence and
provenance. AI output may navigate, classify, reconcile, compare, and flag
anomalies, but it is not ground truth.

If evidence is missing, stale, blocked, ambiguous, or conflicted:

```txt
verification_status = "manual_review"
```

Preserve conflicting observations. Do not overwrite or delete them to produce a
cleaner result.
