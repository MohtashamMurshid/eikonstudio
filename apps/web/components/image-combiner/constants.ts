import { EXECUTABLE_IMAGE_MODELS } from "@eikonstudio/core";
import {
  IMAGE_MODEL_GEMINI,
  IMAGE_MODEL_GEMINI_PRO,
  IMAGE_MODEL_GPT_IMAGE_2,
  type ImageModelId,
} from "@/lib/image-models";

export { IMAGE_MODEL_GEMINI, IMAGE_MODEL_GEMINI_PRO, IMAGE_MODEL_GPT_IMAGE_2 };
export type { ImageModelId };

const logoForProvider = {
  openai: { logo: "/logos/gpt-image.svg", logoClassName: "dark:invert" },
  google: { logo: "/logos/gemini.svg" },
} as const;

export const IMAGE_MODEL_OPTIONS: {
  id: ImageModelId;
  label: string;
  logo: string;
  /** Extra classes for the logo <img> (e.g. invert black mark to white in dark mode) */
  logoClassName?: string;
}[] = EXECUTABLE_IMAGE_MODELS.map((model) => {
  const providerLogo = logoForProvider[model.providerId as keyof typeof logoForProvider];
  return {
    id: model.nativeId as ImageModelId,
    label: model.aliases[0] ? `${model.aliases[0]} · ${model.displayName}` : model.displayName,
    ...providerLogo,
  };
});

export const randomPrompts = [
  "A cyberpunk cityscape with neon lights reflecting on wet streets at midnight",
  "A majestic dragon soaring through clouds above ancient mountain peaks",
  "A cozy coffee shop in a treehouse with fairy lights and hanging plants",
  "An underwater palace made of coral with bioluminescent sea creatures",
  "A steampunk airship floating above Victorian London in golden hour",
  "A magical forest with glowing mushrooms and ethereal mist",
  "A futuristic space station orbiting a purple nebula",
  "A vintage diner on Route 66 with classic cars parked outside",
  "A crystal cave with rainbow light refractions and floating gems",
  "A Japanese garden in autumn with koi pond and red maple trees",
  "A post-apocalyptic library overgrown with vines and nature",
  "A floating island with waterfalls cascading into clouds below",
  "A neon-lit arcade from the 80s with retro gaming machines",
  "A medieval castle on a cliff during a thunderstorm",
  "A bioluminescent alien jungle with exotic flora and fauna",
  "A cozy cabin in snowy mountains with smoke from the chimney",
  "A surreal desert with giant clock towers and melting timepieces",
  "A Victorian greenhouse filled with exotic plants and butterflies",
  "A cybernetic wolf howling at a digital moon in cyberspace",
  "A floating market in Venice with gondolas and colorful awnings",
  "A crystal palace made of ice with aurora borealis overhead",
  "A retro-futuristic diner on Mars with Earth visible in the sky",
  "A mystical portal in an ancient stone circle at dawn",
  "A steampunk laboratory with brass instruments and glowing vials",
  "A underwater city with glass domes and swimming mermaids",
  "A giant tree house city connected by rope bridges",
  "A neon samurai in a rain-soaked Tokyo alleyway",
  "A magical bookstore where books float and pages turn themselves",
  "A desert oasis with palm trees and a crystal-clear spring",
  "A space elevator reaching from Earth to a orbital station",
  "A haunted mansion with glowing windows on a foggy night",
  "A robot garden where mechanical flowers bloom with LED petals",
  "A pirate ship sailing through clouds in the sky",
  "A crystal dragon perched on a mountain of gemstones",
  "A cyberpunk street market with holographic vendors",
  "A fairy tale cottage with a thatched roof and flower garden",
  "A futuristic subway station with levitating trains",
  "A magical academy floating in the clouds with flying students",
  "A bioluminescent coral reef city with mermaid inhabitants",
  "A steampunk clocktower with gears visible through glass panels",
  "A post-apocalyptic greenhouse dome in a wasteland",
  "A dragon's hoard in a crystal cave filled with treasure",
  "A cybernetic forest where trees have circuit board bark",
  "A floating monastery on a mountain peak above the clouds",
  "A retro space diner with alien customers and robot waiters",
  "A magical winter wonderland with ice sculptures and snow fairies",
  "A underwater volcano with thermal vents and exotic sea life",
  "A steampunk carnival with mechanical rides and brass decorations",
  "A crystal city built inside a massive geode",
  "A cyberpunk rooftop garden with neon plants and digital rain",
  "A medieval tavern with a roaring fireplace and wooden beams",
  "A space whale swimming through a nebula of stars",
  "A magical potion shop with floating ingredients and glowing bottles",
  "A post-apocalyptic overgrown subway station with nature reclaiming it",
  "A crystal bridge spanning between two floating islands",
  "A cybernetic phoenix rising from digital flames",
  "A cozy lighthouse on a rocky coast during a storm",
  "A steampunk airship dock with multiple vessels and brass fittings",
  "A magical mirror maze with reflections showing different worlds",
  "A bioluminescent mushroom forest with glowing spores floating",
  "A futuristic greenhouse on Mars growing Earth plants",
  "A dragon sleeping on a pile of books in an ancient library",
  "A cyberpunk street art mural that moves and changes colors",
  "A floating tea house above cherry blossom trees in spring",
  "A crystal waterfall flowing upward into the sky",
  "A steampunk submarine exploring an underwater canyon",
  "A magical snow globe containing a miniature winter village",
  "A post-apocalyptic rooftop garden with solar panels and plants",
  "A cybernetic butterfly garden with holographic flowers",
  "A medieval blacksmith shop with glowing forge and sparks",
  "A space elevator cable stretching into a starry sky",
  "A magical treehouse library with books growing on branches",
  "A bioluminescent cave system with underground rivers",
  "A steampunk observatory with a massive brass telescope",
  "A crystal palace floating in aurora-filled skies",
  "A cyberpunk food truck serving neon-colored dishes",
  "A cozy bookshop cat cafe with felines reading books",
  "A post-apocalyptic wind farm with nature growing around turbines",
  "A magical ice skating rink with frozen waterfalls as backdrop",
  "A underwater steampunk city with brass submarines",
  "A dragon's nest built in the crown of a giant tree",
  "A cybernetic garden where flowers bloom in binary patterns",
  "A floating wizard tower surrounded by levitating rocks",
  "A crystal mine with workers harvesting rainbow gems",
  "A steampunk train station with ornate Victorian architecture",
  "A magical aurora dancing over a frozen lake",
  "A bioluminescent alien forest with singing plants",
  "A post-apocalyptic arcade where nature has taken over the games",
  "A cyberpunk temple with holographic monks meditating",
  "A cozy hobbit hole with round doors and flower gardens",
  "A crystal cathedral with stained glass windows casting rainbow light",
  "A steampunk circus with mechanical performers and brass instruments",
  "A magical bookstore where stories come alive and walk around",
]

