export type TagFacetIndustryLevel = "l1" | "l2" | "l3";

export interface TagFacetIndustry {
  level: TagFacetIndustryLevel;
  name: string;
  tag: string;
}

export interface TagFacetTheme {
  provider: string | null;
  name: string;
  tag: string;
}

export interface TagFacets {
  industry: TagFacetIndustry[];
  themes: TagFacetTheme[];
  userTags: string[];
  otherTags: string[];
}

const INDUSTRY_RE = /^ind:sw:(l[123]):(.+)$/;

export function buildTagFacets(tags: string[]): TagFacets {
  const industry: TagFacetIndustry[] = [];
  const themes: TagFacetTheme[] = [];
  const userTags: string[] = [];
  const otherTags: string[] = [];

  const seenIndustry = new Set<string>();
  const seenThemes = new Set<string>();
  const seenUser = new Set<string>();
  const seenOther = new Set<string>();

  for (const rawTag of tags) {
    const tag = rawTag.trim();
    if (!tag) continue;
    const industryMatch = tag.match(INDUSTRY_RE);
    if (industryMatch) {
      const level = industryMatch[1] as TagFacetIndustryLevel;
      const name = industryMatch[2]?.trim();
      if (name && !seenIndustry.has(tag)) {
        industry.push({ level, name, tag });
        seenIndustry.add(tag);
      }
      continue;
    }

    if (tag.startsWith("theme:")) {
      if (!seenThemes.has(tag)) {
        themes.push(parseThemeTag(tag));
        seenThemes.add(tag);
      }
      continue;
    }

    if (tag.startsWith("user:")) {
      if (!seenUser.has(tag)) {
        userTags.push(tag);
        seenUser.add(tag);
      }
      continue;
    }

    if (!seenOther.has(tag)) {
      otherTags.push(tag);
      seenOther.add(tag);
    }
  }

  industry.sort((a, b) => {
    if (a.level !== b.level) {
      return levelOrder(a.level) - levelOrder(b.level);
    }
    return a.name.localeCompare(b.name);
  });

  themes.sort((a, b) => {
    const providerA = a.provider ?? "";
    const providerB = b.provider ?? "";
    if (providerA !== providerB) {
      return providerA.localeCompare(providerB);
    }
    return a.name.localeCompare(b.name);
  });

  userTags.sort((a, b) => a.localeCompare(b));
  otherTags.sort((a, b) => a.localeCompare(b));

  return { industry, themes, userTags, otherTags };
}

function parseThemeTag(tag: string): TagFacetTheme {
  const rest = tag.slice("theme:".length);
  const parts = rest.split(":").map((value) => value.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      provider: parts[0] ?? null,
      name: parts.slice(1).join(":"),
      tag
    };
  }
  if (parts.length === 1) {
    return {
      provider: null,
      name: parts[0],
      tag
    };
  }
  return {
    provider: null,
    name: rest,
    tag
  };
}

function levelOrder(level: TagFacetIndustryLevel): number {
  switch (level) {
    case "l1":
      return 1;
    case "l2":
      return 2;
    case "l3":
      return 3;
    default:
      return 9;
  }
}
