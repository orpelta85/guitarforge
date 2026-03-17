# Default Approach

- Assume MVP unless told otherwise
- Read SPEC.md before any feature work
- Prefer extending existing components over creating new ones
- If used once, write inline — no helper functions for one-off logic

## Decision Heuristics

- "Is this in SPEC.md?" → follow the spec
- "Would a single line fix this?" → do that
- "Am I adding this for a hypothetical future?" → don't
- "Can I extend GuitarForgeApp.tsx?" → do that before creating new components
