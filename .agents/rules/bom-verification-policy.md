# BOM Verification Policy

Agents and code must not infer:

- missing part numbers
- missing diagram refs
- missing prices
- section membership
- appliance compatibility
- substitutions
- manufacturer identity

If evidence is missing, stale, blocked, or conflicted, return `manual_review` and preserve the conflict with provenance.
