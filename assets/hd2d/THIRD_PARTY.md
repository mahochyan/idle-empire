# Three.js runtime

- Package: `three@0.158.0`
- Source: official npm package `https://registry.npmjs.org/three/-/three-0.158.0.tgz`
- Bundled file: `build/three.min.js` (classic UMD build, loaded locally)
- License: MIT; see `LICENSE` in this directory.

The library runs from the project's own origin. No CDN request is needed at runtime.

The bundle has one local change: `patch-three-rng.mjs` replaces its 21
`Math.random()` calls with a private deterministic generator inside the UMD
closure. This prevents scene setup, UUID generation, and rendering from
advancing the game's combat RNG. Reapply the script after replacing this file
with the pristine official `three@0.158.0` build.
