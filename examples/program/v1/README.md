# Intent Program 1 examples

Each `.ashfox` file is a plain UTF-8 Intent Program 1 source without a byte
order mark. It is the only durable project authority, never a generated
project archive. Each asset family owns one directory and may provide both
`hero.ashfox` and `essential.ashfox` variants.

The engine-core example tests parse, compile, materialize, verify production
readiness, and exercise game delivery adapters directly from these sources.
Compiled project state is ephemeral. Delivery bundles are generated on demand
and intentionally not checked in.
