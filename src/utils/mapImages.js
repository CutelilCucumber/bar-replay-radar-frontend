import awardDetails from "./awardDetails.json";

/**
 * Constructs the map background (texture) image URL for a given map via the gex proxy.
 * Uses mapName (internal filename) if available; falls back to a snake_case
 * version of the display name (matches ingested via the fetch path have no
 * mapName stored).
 */
export function getMapImageUrl(mapName, displayName) {
  const name = (mapName ?? displayName ?? "").toLowerCase().replace(/\s+/g, "_");
  if (!name) return "";
  return `https://gex.honu.pw/image-proxy/MapBackground?mapName=${encodeURIComponent(name)}&size=texture-mq`;
}

/**
 * Constructs the unit portrait image URL from gex proxy.
 */
export function getUnitImageUrl(definitionName) {
  return `https://gex.honu.pw/image-proxy/UnitPic?defName=${encodeURIComponent(definitionName)}`;
}

/**
 * Returns all award image URLs from awardDetails.json for preloading.
 */
export function getAwardImageUrls() {
  return Object.values(awardDetails).map((a) => a.imgurl);
}

/**
 * Preloads an array of image URLs in the background.
 * Returns a promise that resolves when all images are loaded or errored.
 */
export function preloadImages(urls) {
  const unique = [...new Set(urls.filter(Boolean))];
  return Promise.allSettled(
    unique.map(
      (url) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = url;
        })
    )
  );
}

/**
 * Extracts all image URLs (map minimaps + unit portraits) from an array of matches.
 */
export function extractImageUrls(matches) {
  const urls = [];

  for (const match of matches) {
    // Map minimap
    urls.push(getMapImageUrl(match.mapName, match.map));

    // Unit portraits from medals
    const medals = match.medals;
    if (medals) {
      for (const section of ["veteranUnits", "killEfficiency", "damageTaken"]) {
        for (const entry of medals[section] ?? []) {
          if (entry.definitionName) {
            urls.push(getUnitImageUrl(entry.definitionName));
          }
        }
      }
    }
  }

  return urls;
}
