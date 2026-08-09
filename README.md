# ashfox — Intent Program asset compiler

ashfox turns one coordinate-free Intent Program into a canonical low-poly
asset. The AI authors and diagnoses the program, decides whether it is ready,
and compiles it atomically. The compiler owns the derived geometry, pixel
surface, hierarchy, rig, and animation. You describe the result in your
agent's external chat, observe the build, and ask for changes in ordinary
language. Delivery is chosen later.

<p align="center">
  <a href="https://ashfox.io"><strong>Open ashfox →</strong></a>
  <br>
  <sub>Describe the asset’s meaning. ashfox derives the model.</sub>
</p>

<p align="center">
  <a href="#use-the-workbench"><strong>Use the workbench</strong></a>
  &nbsp;·&nbsp;
  <a href="#export"><strong>Export</strong></a>
  &nbsp;·&nbsp;
  <a href="https://ashfox.io/docs/"><strong>Read the guides</strong></a>
</p>

## Use the workbench

1. Create a project and give it a name.
2. Give your browser-capable agent this instruction:

   ~~~text
   Fetch and follow https://ashfox.io/workbench/agent-manifest.json using a direct HTTP request such as curl.
   ~~~

3. Describe the asset in ordinary language in the agent's chat outside the
   workbench. The agent authors and diagnoses one complete Intent Program 1,
   stages it, and decides whether to revise or compile.
4. Watch the viewport. While the agent is deciding, ashfox may show an
   ephemeral AI preview automatically. It is visual feedback only and never a
   second canonical asset; it disappears when the agent compiles or revises.
5. Ask for changes in that chat if the result is wrong. The agent revises the
   complete program, recompiles, and performs the required visual checks.
   Change the camera, environment, or motion playback whenever that helps you
   inspect the result.
6. When the status reaches **Ready to export**, download the `.ashfox` source,
   export a delivery artifact, or capture the result.

The technical source authored by the agent looks like this:

~~~text
metadata {
  name "Ember Stag"
  track hero
  domain organism
}

model {
  orientation forward north
  symmetry bilateral
  support feet contacts legs
  body {
    core torso
    mass head single parent torso anchor front growth forward lane center
    limb legs paired parent torso anchor sides growth down lane center
  }
  surface antlers paired fin parent head anchor sides growth up lane center
  shape antlers {
    axis longitudinal
    span medium
    chord narrow
    tip pointed
    offset center
    edge convex
  }
  face {
    full parent head
    eyes paired gaze center
    nose present
    mouth neutral
  }
}

animation {
  idle breathe target torso
}

appearance {
  palette ember
  texture mottle scale broad density balanced contrast subtle
  seed ember-stag
  mark pale-belly target body torso region ventral placement whole as wash tone lighter scale broad density sparse contrast subtle
  mark antler-tips target surface antlers region full placement tip as patch tone accent scale medium density sparse contrast medium
}
~~~

The source states semantic relationships, not coordinates, cubes, pivots,
materials, UVs, or keyframes. The compiler derives those details and rejects a
program that cannot produce a valid canonical asset.

Surface Appearance V1 lets the agent describe a material character and a few
semantic local markings without exposing UVs or procedural parameters. The
seed is deterministic; palette and contrast alter color projection without
moving the compiled masks.

Intent Program language version 1 also supports explicit semantic lanes and
multiple declared contacts. For example, a four-wheel chassis can give two
wheel pairs the same topology `parent`, `anchor sides`, and `growth down`, but
distinct `leading` and `trailing` lanes, then name both IDs in `support wheels
contacts ...`. These are closed relationships, not editable coordinates.

Symmetry is layered: `asymmetric` describes global ownership but may still
contain explicitly paired wheels, limbs, surfaces, or eyes. Only those local
pairs receive reflection authority; the root remains asymmetric.

## Revise the right thing

The compiled Intent Program remains the asset authority. When a result is
wrong, state the visual relationship that should change and have the agent
submit a revised complete program. For example, ask for a wider rear stance,
a pair of upward fins, or eyes that remain readable from a three-quarter view.
Do not prescribe implementation details; they are compiler output.

Essential produces a compact, intentional read. Hero keeps the same semantic
identity with more compiler-derived secondary form. Neither track changes the
asset’s subject, declared support, face meaning, or supported surface obligations.

## Export

The project stores no delivery target. **Export unavailable** remains clickable
while the AI is building or reviewing so you can read the requirement. When
the status rail reaches **Ready to export**, open **Export delivery files** and
choose Java block, GeckoLib 5, Bedrock, GLB, or glTF. A
Minecraft adapter may ask for its game version, namespace, and model path.
Those values exist only for that export operation; they never rewrite the
Intent Program or canonical asset.

The adapter reports incompatible features, conversions, omissions, artifact
metadata, and a content hash before delivery.

## Local data and source

- The workbench keeps the project in your browser.
- A `.ashfox` file is plain UTF-8 Intent Program 1 source. Opening it compiles
  a fresh canonical asset; compiled project state is never the file authority.
- ashfox does not require an account or project upload.
- The Web Studio canonical project and an optional Blockbench compatibility
  session are separate authorities. They do not synchronize implicitly; move
  an artifact between them only through an explicit file or adapter workflow.
- Source for the engine, workbench, export adapters, and site is in this
  repository under the MIT license.

## Build from source

~~~bash
git clone https://github.com/sigee-min/ashfox.git
cd ashfox
npm install
npm run build
~~~

Before publishing a change, run:

~~~bash
npm test
npm run build:public
npm run quality:check
~~~

See [CONTRIBUTING.md](CONTRIBUTING.md) for repository conventions and
[docs/](docs/README.md) for user guides.
The versioned [development manifest](development-manifest.json) is the
repository rule authority; coding agents can begin with the short
[AGENTS.md](AGENTS.md) bootstrap.

## License

MIT. See [LICENSE](LICENSE).
