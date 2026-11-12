export const assetVersion = Date.now().toString(36);

export const versioned = (path) => `${path}?v=${assetVersion}`;
