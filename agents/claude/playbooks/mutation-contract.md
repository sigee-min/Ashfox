# Claude Playbook: Mutation Contract

1. `get_project_state` -> capture `revision`.
2. Run one mutation with `ifRevision`.
3. Verify response and new revision.
4. `get_project_state` -> confirm post-condition.
5. On revision mismatch, refresh and retry once.

