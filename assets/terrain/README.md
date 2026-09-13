# Terrain data

The game uses a 3×3 group of Mapzen Terrarium elevation tiles around each location at zoom 11.
Terrain Tiles are an open global bare-earth elevation dataset hosted in the AWS Open Data Registry.
The Kazakhstan tiles used here identify SRTM as their imagery source.

- Dataset: https://registry.opendata.aws/terrain-tiles/
- Encoding: https://github.com/tilezen/joerd/blob/master/docs/formats.md
- Attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md

Run `npm run terrain:fetch` to restore the vendored tiles.
