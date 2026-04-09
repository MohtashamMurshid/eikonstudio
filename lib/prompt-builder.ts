import type { Character } from "@/components/video-combiner/types";

function describeCharacter(char: Character): string {
  const parts: string[] = [];

  const { appearance } = char;
  const physicalParts: string[] = [];

  if (appearance.age) physicalParts.push(appearance.age);
  if (appearance.gender) physicalParts.push(appearance.gender);
  if (appearance.build) physicalParts.push(`${appearance.build} build`);
  if (appearance.height) physicalParts.push(appearance.height);
  if (appearance.skinTone) physicalParts.push(`${appearance.skinTone} skin`);
  if (appearance.hairColor || appearance.hairStyle) {
    const hair = [appearance.hairColor, appearance.hairStyle].filter(Boolean).join(" ");
    physicalParts.push(`${hair} hair`);
  }
  if (appearance.eyeColor) physicalParts.push(`${appearance.eyeColor} eyes`);
  if (appearance.facialHair && appearance.facialHair.toLowerCase() !== "none") {
    physicalParts.push(`with ${appearance.facialHair}`);
  }

  if (physicalParts.length > 0) {
    parts.push(`${char.name}, a ${physicalParts.join(", ")}`);
  } else {
    parts.push(char.name);
  }

  if (char.archetype) parts.push(`(${char.archetype})`);
  if (char.outfit) parts.push(`wearing ${char.outfit}`);
  if (char.details) parts.push(char.details);

  return parts.join(". ").replace(/\.\./g, ".");
}

export function buildVideoPrompt(params: {
  characters: Character[];
  location?: string;
  mood?: string;
  action: string;
}): string {
  const sections: string[] = [];

  if (params.characters.length > 0) {
    const charDescriptions = params.characters.map(describeCharacter);
    if (charDescriptions.length === 1) {
      sections.push(charDescriptions[0]);
    } else {
      sections.push(`Characters: ${charDescriptions.join("; ")}`);
    }
  }

  if (params.location) {
    sections.push(`Setting: ${params.location}`);
  }

  if (params.mood) {
    sections.push(`${params.mood} mood`);
  }

  sections.push(params.action);

  return sections.join(". ").replace(/\.\./g, ".").trim();
}
