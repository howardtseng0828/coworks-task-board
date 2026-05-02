export const toPseudoGroupId = (groupName: string) => {
  let hash = 0;
  for (let index = 0; index < groupName.length; index += 1) {
    hash = (hash * 31 + groupName.charCodeAt(index)) >>> 0;
  }
  return 1_000_000_000 + (hash % 800_000_000);
};

export const toPseudoUserId = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }
  return 2_000_000_000 + (hash % 600_000_000);
};

const legacyPlaceholderGroups = new Set(["product", "engineering", "enginnering", "marketing", "operations"]);

export const isLegacyPlaceholderGroup = (groupName: string | null | undefined) => {
  const normalized = groupName?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return legacyPlaceholderGroups.has(normalized);
};
