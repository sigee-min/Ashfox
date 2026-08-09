# ashfox — Intent Program asset compiler

ashfox turns one confirmed, coordinate-free Intent Program into a canonical
low-poly asset. The compiler owns the derived geometry, pixel surface,
hierarchy, rig, and canonical idle. You review the program before compilation,
review the resulting asset afterward, and choose a delivery adapter only when
you export.

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

3. Describe the asset in ordinary language. The agent submits one complete
   Intent Program proposal.
4. Read the displayed program, including its forward direction, symmetry,
   resting support, face, and supported surfaces. Confirm only when that
   meaning is correct.
5. ashfox compiles the canonical asset atomically. Review the result, then
   revise the Intent Program if the result needs a different meaning.

For example:

~~~text
asset "Ember Stag"
track hero
domain organism
frame front north
symmetry bilateral
rest neutral feet
body core torso
body limb legs pair from torso
surface antlers pair fin from torso extends up
face full
eyes pair gaze center
nose present
mouth neutral
style palette ember
~~~

The source states semantic relationships, not coordinates, cubes, pivots,
materials, UVs, or keyframes. The compiler derives those details and rejects a
program that cannot produce a valid canonical asset.

## Revise the right thing

The Intent Program remains the asset authority. When a result is wrong, state
the visual relationship that should change and have the agent submit a revised
complete program. For example, ask for a wider rear stance, a pair of upward
fins, or eyes that remain readable from a three-quarter view. Do not prescribe
implementation details; they are compiler output.

Essential produces a compact, intentional read. Hero keeps the same semantic
identity with more compiler-derived secondary form. Neither track changes the
asset’s subject, neutral rest, face meaning, or supported surface obligations.

## Export

The project stores no delivery target. Open **Export** only after the canonical
asset is ready, then choose Java block, GeckoLib 5, Bedrock, GLB, or glTF. A
Minecraft adapter may ask for its game version, namespace, and model path.
Those values exist only for that export operation; they never rewrite the
Intent Program or canonical asset.

The adapter reports incompatible features, conversions, omissions, artifact
metadata, and a content hash before delivery.

## Local data and source

- The workbench keeps the project in your browser.
- ashfox does not require an account or project upload.
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

## License

MIT. See [LICENSE](LICENSE).
