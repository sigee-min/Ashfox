# Constraint Profiles

Constraint profiles define structural rules that the skill must evaluate before craft-level tuning.

## File format
YAML with:
- `version`
- `name`
- `scope`
- `landmarks`
- `rules`

## Rule types
- `mirror_pair`
- `midline_distance`
- `vertical_order`
- `distance_range`
- `direction_alignment`
- `ground_contact_band`

## Notes
- Profiles are declarative policy. They do not implement geometry math.
- Skill runner evaluates these rules using current project state.
- Keep tolerances explicit and conservative.

## Included profiles
- `humanoid-face.yaml`
- `biped-foot.yaml`
