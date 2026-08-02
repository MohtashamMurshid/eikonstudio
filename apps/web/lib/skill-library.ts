export const SKILL_CATEGORIES = [
  "style",
  "composition",
  "brand",
  "lighting",
  "mood",
  "subject",
  "other",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export interface SkillSections {
  styleOverview?: string;
  visualHallmarks?: string;
  composition?: string;
  lighting?: string;
  palette?: string;
  materialsAndTextures?: string;
  mustInclude?: string;
  avoid?: string;
  negativePrompt?: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  category: SkillCategory;
  tags: string[];
  sections?: SkillSections;
  freeformInstructions?: string;
  promptText?: string;
  isBuiltIn: boolean;
  isEditable: boolean;
  sortOrder?: number;
  builtInSkillKey?: string;
}

type SkillLike = Omit<Partial<SkillDefinition>, "category"> & {
  name: string;
  description?: string;
  category?: string;
  sections?: SkillSections;
  freeformInstructions?: string;
  promptText?: string;
};

function compactLines(lines: Array<string | undefined | null | false>): string {
  return lines
    .map((line) => (typeof line === "string" ? line.trim() : ""))
    .filter(Boolean)
    .join("\n");
}

function sectionLine(label: string, value?: string): string | null {
  if (!value?.trim()) return null;
  return `${label}: ${value.trim()}`;
}

function skill(
  name: string,
  description: string,
  sortOrder: number,
  sections: SkillSections,
  freeformInstructions?: string,
  tags: string[] = [],
): SkillDefinition {
  return {
    name,
    description,
    category: "style",
    tags,
    sections,
    freeformInstructions,
    isBuiltIn: true,
    isEditable: true,
    sortOrder,
    builtInSkillKey: name,
  };
}

export function renderSkillPrompt(skillDefinition: SkillLike): string {
  const sections = skillDefinition.sections ?? {};
  const hasStructuredContent = Object.values(sections).some((value) => Boolean(value?.trim()));
  const freeform = skillDefinition.freeformInstructions?.trim();
  const promptText = skillDefinition.promptText?.trim();

  if (!hasStructuredContent && !freeform && promptText) {
    return promptText;
  }

  const intro =
    skillDefinition.category === "style"
      ? `Apply the "${skillDefinition.name}" visual skill with the following art direction.`
      : `Apply the "${skillDefinition.name}" skill with the following guidance.`;

  return compactLines([
    intro,
    sectionLine("Style overview", sections.styleOverview),
    sectionLine("Visual hallmarks", sections.visualHallmarks),
    sectionLine("Composition", sections.composition),
    sectionLine("Lighting", sections.lighting),
    sectionLine("Palette", sections.palette),
    sectionLine("Materials and textures", sections.materialsAndTextures),
    sectionLine("Must include", sections.mustInclude),
    sectionLine("Avoid", sections.avoid),
    sectionLine("Negative prompt", sections.negativePrompt),
    freeform ? `Additional direction: ${freeform}` : null,
    !freeform && promptText ? `Additional direction: ${promptText}` : null,
  ]);
}

export function matchesSkillSearch(skillDefinition: SkillLike, rawSearchTerm: string): boolean {
  const searchTerm = rawSearchTerm.trim().toLowerCase();
  if (!searchTerm) return true;

  const haystack = [
    skillDefinition.name,
    skillDefinition.description,
    skillDefinition.category,
    skillDefinition.freeformInstructions,
    skillDefinition.promptText,
    ...(skillDefinition.tags ?? []),
    ...Object.values(skillDefinition.sections ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm);
}

export const builtInSkills: SkillDefinition[] = [
  skill(
    "renaissance",
    "Italian High Renaissance painting with balance, grace, and humanist realism.",
    10,
    {
      styleOverview:
        "A refined Renaissance painting that feels studied, noble, balanced, and rooted in classical humanist ideals rather than generic vintage art.",
      visualHallmarks:
        "Anatomically believable figures, graceful poses, idealized realism, careful perspective, architectural harmony, and painterly control inspired by masters such as Raphael, Leonardo, and Titian.",
      composition:
        "Use stable triangular or symmetrical compositions, clear focal hierarchy, elegant spacing between figures, and a calm sense of order with believable depth.",
      lighting:
        "Soft directional light with gentle modelling across faces and drapery, subtle shadow transitions, and a luminous atmosphere rather than stark contrast.",
      palette:
        "Warm earth pigments, muted ultramarine, terracotta, olive, cream, parchment, wine red, and restrained gold accents.",
      materialsAndTextures:
        "Oil-on-panel or early oil-on-canvas feeling, glazed paint layers, natural skin textures, marble, brocade, vellum, and richly painted fabric folds.",
      mustInclude:
        "Classical dignity, believable anatomy, subtle symbolism, elegant costume or drapery, and carefully staged spatial depth.",
      avoid:
        "Do not drift into medieval flatness, fantasy cosplay, cartoon faces, noisy digital effects, or overly dramatic Baroque darkness.",
      negativePrompt:
        "Low-detail faces, comic-book styling, neon colors, messy brushwork, exaggerated anatomy, cheap fantasy armor, modern props, text overlays.",
    },
    "Favor beauty, harmony, and intellectual clarity. The result should feel museum-worthy and composed with patient craftsmanship.",
    ["classic", "painting", "fine-art"],
  ),
  skill(
    "baroque",
    "Dramatic Baroque painting with motion, theatrical light, and grandeur.",
    20,
    {
      styleOverview:
        "A Baroque image charged with drama, motion, and emotional intensity rather than static classical restraint.",
      visualHallmarks:
        "Dynamic gestures, sweeping diagonals, luxurious fabrics, expressive faces, ornate detail, and a sense of theatrical escalation.",
      composition:
        "Use energetic asymmetry, diagonal movement, layered foreground-background staging, and compositions that feel mid-action.",
      lighting:
        "Strong chiaroscuro with bold shafts of light cutting through darkness, sculptural highlights, and heightened drama.",
      palette:
        "Deep crimson, umber, ivory, antique gold, midnight green, warm skin tones, and rich shadow masses.",
      materialsAndTextures:
        "Lacquered wood, velvet, gilded ornament, polished metal, candlelit interiors, and painterly brushwork with lush surfaces.",
      mustInclude:
        "A sense of grandeur, theatrical tension, emotional charge, and luxurious visual richness.",
      avoid:
        "Avoid minimalist emptiness, pastel flatness, modern clean design language, and calm Renaissance symmetry.",
      negativePrompt:
        "Flat lighting, washed-out colors, cartoon simplicity, low ornament, weak focal point, static posing, modern clothing.",
    },
    "Push the image toward cinematic opulence and emotional spectacle while keeping the painting cohesive and believable.",
    ["dramatic", "painting", "ornate"],
  ),
  skill(
    "fresco",
    "Wall-painting aesthetic with mineral pigments and aged plaster surfaces.",
    30,
    {
      styleOverview:
        "A fresco mural aesthetic painted into plaster, with mineral pigments and an aged architectural presence.",
      visualHallmarks:
        "Matte painted surfaces, softened edges, simplified modelling, weathered areas, and imagery integrated into a wall rather than floating like modern canvas art.",
      composition:
        "Compose the scene as if designed for an architectural surface, with clear readability, large shapes, and mural-like balance.",
      lighting:
        "Diffuse ambient illumination with gentle tonal modelling and minimal glossy highlights.",
      palette:
        "Ochre, dusty red, limestone cream, faded teal, clay, ash blue, and desaturated earth pigments.",
      materialsAndTextures:
        "Cracked plaster, lime wash, chalky mineral pigment, worn edges, and subtle age staining.",
      mustInclude:
        "Visible wall integration, historical materiality, and a slightly weathered handmade quality.",
      avoid:
        "Do not make it look glossy, digitally polished, hyper-saturated, or like a pristine contemporary mural.",
      negativePrompt:
        "Glossy paint, neon colors, digital shine, crisp vector edges, plastic textures, posterized contrast.",
    },
    "Let the age and materiality of the wall support the subject so the image feels archaeological and tactile.",
    ["mural", "wall", "historic"],
  ),
  skill(
    "impressionist",
    "Light-filled Impressionist painting with broken color and atmosphere.",
    40,
    {
      styleOverview:
        "An Impressionist painting focused on atmosphere, fleeting light, and the sensation of a moment rather than hard detail.",
      visualHallmarks:
        "Visible brushstrokes, broken color, softened contours, airy transitions, and a lively painted surface.",
      composition:
        "Frame the scene like an observed moment, with natural cropping, open air space, and emphasis on visual atmosphere over precise linework.",
      lighting:
        "Sunlit haze, reflected ambient color, shimmering highlights, and changing natural light conditions.",
      palette:
        "Powder blue, pale gold, leafy green, lavender shadow, peach skin tones, and warm off-whites.",
      materialsAndTextures:
        "Loose brushwork, soft impasto accents, canvas tooth, and painterly color vibration.",
      mustInclude:
        "Atmosphere, visible brush energy, and the feeling of a transient scene captured in paint.",
      avoid:
        "Avoid hard outlines, photorealistic detail, muddy color, and graphic poster-like flatness.",
      negativePrompt:
        "Sharp digital edges, over-rendered realism, black outlines, sterile composition, overly dark palette.",
    },
    "Favor sensation over precision so the image feels alive, luminous, and observed from life.",
    ["plein-air", "painting", "light"],
  ),
  skill(
    "cubist",
    "Cubist fragmentation with geometric planes and multiple viewpoints.",
    50,
    {
      styleOverview:
        "A Cubist reinterpretation that fractures the subject into geometric planes and simultaneous viewpoints.",
      visualHallmarks:
        "Angular facets, abstracted anatomy or objects, overlapping forms, rhythmic geometry, and analytical flattening of space.",
      composition:
        "Break the subject into interlocking planar structures with layered depth cues and structured fragmentation across the frame.",
      lighting:
        "Lighting should support form analysis rather than realism, with restrained tonal shifts across planes.",
      palette:
        "Muted ochre, charcoal, slate blue, dusty rose, paper beige, olive, and sepia neutrals.",
      materialsAndTextures:
        "Painted planes, collaged paper suggestions, rough canvas, chalky surfaces, and matte texture.",
      mustInclude:
        "A clear geometric logic and multiple-angle reading of the subject.",
      avoid:
        "Avoid photorealistic rendering, smooth 3D gradients, anime stylization, and decorative softness.",
      negativePrompt:
        "Soft realism, glossy digital shading, cute proportions, literal perspective, neon accents.",
    },
    "Keep the result intelligent and structural so it feels like a deliberate Cubist composition rather than random abstraction.",
    ["geometric", "abstract", "painting"],
  ),
  skill(
    "surrealist",
    "Dreamlike Surrealist imagery with symbolic logic and uncanny calm.",
    60,
    {
      styleOverview:
        "A Surrealist image where ordinary visual language is reorganized into an uncanny dream logic.",
      visualHallmarks:
        "Unexpected juxtapositions, symbolic objects, eerie stillness, impossible scale relationships, and psychologically charged imagery.",
      composition:
        "Use spacious staging and deliberate object placement so the scene feels dreamlike but controlled, not random.",
      lighting:
        "Quiet cinematic light, uncanny dusk or moonlit clarity, and still atmospheric air.",
      palette:
        "Muted desert tones, strange twilight blues, desaturated crimson, pale stone, and smoky greens.",
      materialsAndTextures:
        "Realistic surfaces rendered with subtle unreality, smooth skin, stone, fabric, haze, and dreamlike emptiness.",
      mustInclude:
        "One or more impossible or symbolic visual relationships that feel intentional and haunting.",
      avoid:
        "Avoid psychedelic noise, meme randomness, chaotic clutter, and cartoon absurdity.",
      negativePrompt:
        "Messy collage, comic humor, neon rave colors, childish whimsy, low-detail symbolism, kitsch fantasy.",
    },
    "Keep the image elegant and unsettling, as if it belongs to a lucid dream painted with serious technical control.",
    ["dreamlike", "uncanny", "symbolic"],
  ),
  skill(
    "abstract",
    "Abstract fine-art composition driven by shape, rhythm, and color relationships.",
    70,
    {
      styleOverview:
        "A non-literal abstract artwork focused on composition, movement, color relationships, and formal tension.",
      visualHallmarks:
        "Large intentional shapes, layered marks, balance of density and emptiness, and a coherent visual rhythm.",
      composition:
        "Prioritize spatial rhythm, asymmetry, layering, and shape relationships over representational subject matter.",
      lighting:
        "Lighting should read through paint behavior and tonal structure rather than literal scene illumination.",
      palette:
        "Use a disciplined limited palette with one or two strong accents rather than scattered rainbow color.",
      materialsAndTextures:
        "Brush drag, washes, rough edges, layered paint, scraped passages, and tactile surface depth.",
      mustInclude:
        "A clear compositional intention and visual rhythm that feels authored.",
      avoid:
        "Avoid generic wallpaper vibes, muddy chaos, random splatter without structure, and clip-art geometry.",
      negativePrompt:
        "Low-intent composition, muddy colors, overbusy noise, default gradient art, bland symmetry.",
    },
    "Make the abstraction feel like serious gallery work with tension, restraint, and compositional intelligence.",
    ["gallery", "nonrepresentational", "modern"],
  ),
  skill(
    "realistic",
    "Classical realism with faithful observation and refined natural detail.",
    80,
    {
      styleOverview:
        "A realistic image grounded in believable form, proportion, and texture with disciplined observational accuracy.",
      visualHallmarks:
        "Natural anatomy, accurate materials, plausible space, nuanced detail, and visual credibility.",
      composition:
        "Use a clean readable composition with a clear focal point and grounded spatial relationships.",
      lighting:
        "Naturalistic light that reveals form truthfully without exaggerated cinematic effects.",
      palette:
        "Balanced, credible color with subtle temperature shifts and restrained saturation.",
      materialsAndTextures:
        "Skin pores, cloth weave, weathered surfaces, believable reflections, and grounded physical detail.",
      mustInclude:
        "Observation-driven detail and believable spatial depth.",
      avoid:
        "Avoid plastic skin, uncanny AI smoothness, anime eyes, over-sharpening, and fantasy exaggeration.",
      negativePrompt:
        "Overprocessed detail, plastic texture, surreal anatomy, cartoon outlines, floating objects, neon grading.",
    },
    "Aim for realism with taste and clarity rather than sterile over-rendering.",
    ["observational", "naturalistic", "detail"],
  ),
  skill(
    "watercolor",
    "Traditional watercolor with soft diffusion and visible paper texture.",
    90,
    {
      styleOverview:
        "A handcrafted watercolor image with transparent washes, delicate edges, and visible paper behavior.",
      visualHallmarks:
        "Soft blooms, subtle bleeding, layered transparent color, imperfect edges, and hand-painted restraint.",
      composition:
        "Keep shapes readable and elegant, allowing white space and soft transitions to breathe.",
      lighting:
        "Gentle luminous light, often suggested through preserved paper highlights and transparent color.",
      palette:
        "Diluted pigments, airy blues, mossy greens, rose, ochre, and softly layered neutrals.",
      materialsAndTextures:
        "Cold-press paper grain, water blooms, pigment granulation, wet-on-wet diffusion, and light brush marks.",
      mustInclude:
        "Transparent wash behavior and visible paper presence.",
      avoid:
        "Avoid oil-paint thickness, digital airbrush smoothness, black comic outlines, and harsh contrast.",
      negativePrompt:
        "Glossy rendering, heavy impasto, vector edges, neon gradients, plastic textures, hard cel shading.",
    },
    "Let the medium feel airy, imperfect, and genuinely painted by hand.",
    ["traditional-media", "paper", "wash"],
  ),
  skill(
    "oil-painting",
    "Classical oil-paint richness with depth, glazing, and material presence.",
    100,
    {
      styleOverview:
        "A painterly oil-on-canvas look with layered pigment, subtle glazing, and full-bodied material richness.",
      visualHallmarks:
        "Controlled brushwork, tonal depth, rich darks, dimensional highlights, and a strong sense of paint as matter.",
      composition:
        "Use a composed and readable arrangement with convincing volume and pictorial depth.",
      lighting:
        "Warm studio or natural light that turns form gradually and gives mass to subjects.",
      palette:
        "Earth pigments, lead white feeling, umber, sienna, deep green, muted blue, and restrained accent colors.",
      materialsAndTextures:
        "Canvas tooth, glaze layers, soft impasto, varnished depth, and tactile brush drag.",
      mustInclude:
        "Painterly volume, tonal richness, and authentic fine-art material cues.",
      avoid:
        "Avoid flat poster color, digital over-sharpening, anime rendering, and watercolor softness.",
      negativePrompt:
        "Plastic detail, vector flatness, airbrushed gradients, neon palette, glossy CG materials.",
    },
    "The image should feel materially rich and studio-crafted, like a serious oil painting rather than a generic filter.",
    ["canvas", "fine-art", "painterly"],
  ),
  skill(
    "digital-art",
    "Polished digital illustration with painterly control and clean modern finish.",
    110,
    {
      styleOverview:
        "A premium digital painting or illustration that feels intentional, polished, and art-directed rather than generic AI output.",
      visualHallmarks:
        "Clean shape design, controlled detail, professional finish, and purposeful stylization.",
      composition:
        "Strong focal hierarchy, readable silhouettes, and contemporary illustration clarity.",
      lighting:
        "Stylized but coherent illumination with controlled contrast and art-directed highlights.",
      palette:
        "Curated modern palette with controlled saturation and a clear accent strategy.",
      materialsAndTextures:
        "Selective painterly texture, brushed edges, layered digital paint, and refined surface control.",
      mustInclude:
        "A confident art-direction feel with polish and cohesion.",
      avoid:
        "Avoid muddy prompts, over-rendered noise, inconsistent style mixing, and cheap stock-art vibes.",
      negativePrompt:
        "Cluttered detail, muddy contrast, generic concept-art mush, random textures, washed-out forms.",
    },
    "Make the result feel like premium concept art or editorial illustration with taste and clarity.",
    ["illustration", "modern", "polished"],
  ),
  skill(
    "minimal",
    "Minimalist visual language with restraint, clarity, and strong negative space.",
    120,
    {
      styleOverview:
        "A minimal composition built from restraint, balance, and intentional simplicity rather than emptiness alone.",
      visualHallmarks:
        "Few elements, clean silhouettes, generous negative space, controlled geometry, and elegant visual hierarchy.",
      composition:
        "Use strong spacing, asymmetry or centered calm, and a single dominant focal idea.",
      lighting:
        "Soft clean light with low clutter and subtle shadow definition.",
      palette:
        "Restrained palette with one accent at most; favor neutrals, stone, black, white, and soft muted color.",
      materialsAndTextures:
        "Matte surfaces, smooth paper, subtle grain, minimal texture accents, and quiet material cues.",
      mustInclude:
        "Clarity, confidence, and strong negative space.",
      avoid:
        "Avoid clutter, decorative excess, over-texturing, neon gradients, and random small details.",
      negativePrompt:
        "Busy layout, maximal ornament, noisy background, mixed visual styles, hyper-detailed clutter.",
    },
    "Keep the result calm, premium, and highly intentional so every element earns its place.",
    ["clean", "restrained", "editorial"],
  ),
  skill(
    "expressionist",
    "Emotionally charged expressionist painting with distortion and mood.",
    130,
    {
      styleOverview:
        "An Expressionist image driven by emotion, gesture, and atmosphere over literal realism.",
      visualHallmarks:
        "Heightened brushwork, psychological color, expressive distortion, and visible artistic urgency.",
      composition:
        "Let the frame serve mood first, using strong directional marks and emotionally loaded shape relationships.",
      lighting:
        "Subjective, moody light that intensifies feeling rather than strictly following realism.",
      palette:
        "Bold emotional color, bruised purples, acidic yellow accents, dark blues, ember reds, and charged contrasts.",
      materialsAndTextures:
        "Agitated paint handling, rough edges, smeared or dragged pigment, and visible hand energy.",
      mustInclude:
        "A clear emotional tone carried by both color and mark-making.",
      avoid:
        "Avoid photo realism, sterile digital polish, cute stylization, and decorative prettiness without feeling.",
      negativePrompt:
        "Flat emotion, polished realism, corporate clean design, kawaii expressions, washed-out palette.",
    },
    "Let the image feel psychologically alive and painterly, not merely distorted.",
    ["emotive", "gestural", "mood"],
  ),
  skill(
    "pop-art",
    "Pop Art boldness with graphic repetition, punchy color, and commercial energy.",
    140,
    {
      styleOverview:
        "A Pop Art image that borrows from mass media, print culture, and bold graphic stylization.",
      visualHallmarks:
        "Punchy color blocking, halftone influence, repeated motifs, graphic edges, and playful commercial iconography.",
      composition:
        "Favor bold framing, poster-like punch, repeated forms, and visual wit.",
      lighting:
        "Graphic lighting with clear shape separation rather than painterly naturalism.",
      palette:
        "Electric primary and secondary colors, hot pink, bright cyan, bold yellow, stark black, and crisp white.",
      materialsAndTextures:
        "Screen-print vibe, halftone dots, ink-like edges, poster surfaces, and glossy pop finish.",
      mustInclude:
        "Graphic confidence, media-savvy boldness, and commercial punch.",
      avoid:
        "Avoid muted realism, muddy paint, generic comic art, and luxury minimalism.",
      negativePrompt:
        "Low contrast, dusty palette, painterly softness, realistic shading, bland layout.",
    },
    "Keep the result sharp, clever, and visually loud without becoming messy.",
    ["graphic", "commercial", "bold"],
  ),
  skill(
    "art-nouveau",
    "Decorative Art Nouveau elegance with flowing lines and botanical ornament.",
    150,
    {
      styleOverview:
        "An Art Nouveau composition full of flowing linework, ornamental grace, and organic decorative rhythm.",
      visualHallmarks:
        "Whiplash curves, botanical motifs, elegant framing, stylized figures, and integrated ornamental borders.",
      composition:
        "Use sinuous line movement, decorative framing, and poster-like vertical elegance.",
      lighting:
        "Soft luminous light that flatters ornamental form rather than deep chiaroscuro.",
      palette:
        "Muted jewel tones, sage, peacock blue, cream, dusty gold, burgundy, and floral accents.",
      materialsAndTextures:
        "Ink line, poster paper, enamel-like color fields, floral ornament, and decorative patterning.",
      mustInclude:
        "Graceful flowing lines and ornamental cohesion throughout the image.",
      avoid:
        "Avoid modern minimalism, hard geometric brutalism, plain layouts, and generic fantasy decoration.",
      negativePrompt:
        "Rigid grids, flat corporate design, photorealistic realism, noisy clutter, neon cyberpunk effects.",
    },
    "The result should feel elegant, decorative, and beautifully integrated from figure to frame.",
    ["decorative", "floral", "ornament"],
  ),
  skill(
    "neoclassicism",
    "Neoclassical clarity with idealized form and restrained grandeur.",
    160,
    {
      styleOverview:
        "A Neoclassical image rooted in order, noble restraint, and idealized form with archaeological seriousness.",
      visualHallmarks:
        "Clean anatomy, sculptural bodies, disciplined drapery, classical architecture, and moral clarity.",
      composition:
        "Use balanced horizontal or triangular arrangements, poised gestures, and a clear classical hierarchy.",
      lighting:
        "Even sculptural illumination with calm tonal transitions and little atmospheric chaos.",
      palette:
        "Stone white, muted crimson, cool blue, warm beige, olive, and restrained classical accents.",
      materialsAndTextures:
        "Marble, polished stone, linen, bronze, and smooth finely finished painted surfaces.",
      mustInclude:
        "Classical restraint, idealized beauty, and architectural order.",
      avoid:
        "Avoid Baroque drama, romantic excess, cluttered ornament, or loose painterly chaos.",
      negativePrompt:
        "Messy brushwork, melodrama, neon color, modern clothing, cartoon anatomy, chaotic backgrounds.",
    },
    "Aim for intellectual clarity and sculptural poise rather than theatrical spectacle.",
    ["classical", "sculptural", "refined"],
  ),
  skill(
    "technical-blueprint",
    "Monochrome technical diagram with blueprint precision and exploded-view logic.",
    170,
    {
      styleOverview:
        "A precise technical illustration rendered like a retro digital blueprint with engineering clarity.",
      visualHallmarks:
        "Exploded components, isometric or orthographic logic, labeled callouts, guide lines, and strict drafting discipline.",
      composition:
        "Stage parts in a clear structural hierarchy with spacing that explains assembly and function.",
      lighting:
        "Keep lighting secondary to line clarity and diagram legibility.",
      palette:
        "Monochrome blueprint blue with pale technical paper, cool white, and measured tonal fills.",
      materialsAndTextures:
        "Drafting lines, faint grid paper, transparent fill overlays, dashed alignment guides, and annotation marks.",
      mustInclude:
        "Engineering readability, component separation, and controlled annotation logic.",
      avoid:
        "Avoid painterly flourish, realistic photography lighting, messy perspective, and decorative clutter.",
      negativePrompt:
        "Random shadows, soft focus, hand-drawn wobble, multicolor palette, cinematic depth blur, noisy textures.",
    },
    "This should feel like a premium technical artifact, halfway between engineering documentation and editorial design.",
    ["diagram", "isometric", "technical"],
  ),
  skill(
    "anime",
    "Polished anime illustration with expressive characters and cinematic stylization.",
    180,
    {
      styleOverview:
        "A high-quality anime-style illustration with confident linework, expressive design, and art-directed stylization.",
      visualHallmarks:
        "Expressive eyes, clean contour lines, stylized anatomy, dynamic posing, and polished cel-style rendering.",
      composition:
        "Use strong silhouettes, dynamic camera framing, and emotionally readable staging.",
      lighting:
        "Stylized cinematic lighting with crisp edge highlights and dramatic separation where useful.",
      palette:
        "Vibrant but curated palettes with controlled saturation and clear accent colors.",
      materialsAndTextures:
        "Cel-shaded forms, clean digital paint, subtle texture overlays, and sharp illustrative finish.",
      mustInclude:
        "Readable character appeal and intentional anime design language.",
      avoid:
        "Avoid generic AI mush, over-rendered realism, plastic skin, and inconsistent line quality.",
      negativePrompt:
        "Photorealism, muddy faces, extra fingers, inconsistent anatomy, washed-out colors, random texture noise.",
    },
    "Favor premium key-art quality over low-effort generic anime filters.",
    ["character", "illustration", "stylized"],
  ),
  skill(
    "portrait",
    "High-end portrait photography with flattering light and subject presence.",
    190,
    {
      styleOverview:
        "A polished portrait focused on presence, flattering light, and premium editorial quality.",
      visualHallmarks:
        "Strong eye contact or intentional gaze, beautiful skin rendering, controlled background, and crisp focal emphasis.",
      composition:
        "Use portrait framing with clean separation, elegant cropping, and strong subject hierarchy.",
      lighting:
        "Soft studio light, subtle catchlights, and refined facial modelling without harsh unflattering contrast.",
      palette:
        "Controlled neutral or fashion palette with tasteful accent color in wardrobe or backdrop.",
      materialsAndTextures:
        "Natural skin texture, fabric detail, lens softness in the background, and premium photo finish.",
      mustInclude:
        "A compelling subject presence and flattering professional lighting.",
      avoid:
        "Avoid uncanny skin smoothing, harsh flash, distorted anatomy, and chaotic backgrounds.",
      negativePrompt:
        "Plastic face, extra limbs, low-res skin, random clutter, poor eye detail, aggressive HDR.",
    },
    "The image should feel like a fashion or magazine portrait rather than a selfie or stock photo.",
    ["photography", "people", "editorial"],
  ),
  skill(
    "cinematic",
    "Film-like visual language with dramatic composition and atmosphere.",
    200,
    {
      styleOverview:
        "A cinematic image that feels like a carefully art-directed film still rather than a generic dramatic filter.",
      visualHallmarks:
        "Controlled depth, strong framing, atmospheric layering, visual storytelling, and emotionally charged composition.",
      composition:
        "Use a clear narrative frame with foreground-midground-background depth and deliberate camera placement.",
      lighting:
        "Dramatic cinematic lighting, motivated sources, moody shadow control, and rich atmosphere.",
      palette:
        "Film-inspired grading with disciplined contrast, warm-cool interplay, and selective accent color.",
      materialsAndTextures:
        "Subtle grain, haze, practical light bloom, weathered surfaces, and controlled texture realism.",
      mustInclude:
        "Storytelling atmosphere and believable filmic staging.",
      avoid:
        "Avoid random lens flares, muddy blockbuster chaos, oversaturated teal-orange clichés, and visual noise.",
      negativePrompt:
        "Flat lighting, cheap HDR, cartoon rendering, weak focal hierarchy, sterile background, blown highlights.",
    },
    "The result should feel like a frame from a beautiful, expensive movie with clear visual intent.",
    ["film", "atmosphere", "storytelling"],
  ),
  skill(
    "3d",
    "Premium 3D render with believable materials and studio-grade polish.",
    210,
    {
      styleOverview:
        "A polished 3D render with professional material work, controlled lighting, and a premium visualization finish.",
      visualHallmarks:
        "Believable form, realistic or stylized materials, crisp edges, controlled reflections, and rendered depth.",
      composition:
        "Use a clean hero composition with strong silhouette readability and careful spacing.",
      lighting:
        "Studio-quality lighting with volumetric depth where useful and controlled highlight behavior.",
      palette:
        "Purposeful palette tied to product or scene identity, never random saturated clutter.",
      materialsAndTextures:
        "Convincing glass, metal, plastic, fabric, stone, subsurface scattering, and micro-surface detail.",
      mustInclude:
        "A premium rendering finish with coherent material logic.",
      avoid:
        "Avoid game-engine cheapness, noisy reflections, plasticky materials, and weak lighting.",
      negativePrompt:
        "Low-poly feel, muddy reflections, blown speculars, jagged edges, flat AO, noisy background.",
    },
    "Favor quality comparable to premium product visualization or high-end motion design stills.",
    ["render", "cg", "materials"],
  ),
  skill(
    "pixel",
    "Retro pixel-art direction with intentional scale and limited-palette discipline.",
    220,
    {
      styleOverview:
        "A deliberately crafted pixel-art image with strong silhouette design and old-school sprite logic.",
      visualHallmarks:
        "Clean pixel clusters, controlled dithering, limited palette, readable forms, and retro game charm.",
      composition:
        "Compose for clarity at small scale, with distinct silhouettes and strong blocky read.",
      lighting:
        "Use simplified lighting logic with selective highlights and strong value separation.",
      palette:
        "Tight limited palette with nostalgic game-inspired color choices.",
      materialsAndTextures:
        "Visible pixel grid, sprite-like edges, selective dithering, and no smooth anti-aliased painting.",
      mustInclude:
        "Pixel readability and palette discipline.",
      avoid:
        "Avoid smooth gradients, soft airbrush rendering, photorealistic detail, and inconsistent pixel scale.",
      negativePrompt:
        "Blurry edges, AI mush, mixed resolutions, anti-aliased vectors, soft texture painting.",
    },
    "The result should look hand-crafted for a premium retro game rather than simply downscaled art.",
    ["retro", "sprite", "game-art"],
  ),
  skill(
    "sketch",
    "Hand-drawn sketch with expressive linework and construction energy.",
    230,
    {
      styleOverview:
        "A sketchbook-style drawing with visible hand energy, structural linework, and unfinished charm.",
      visualHallmarks:
        "Graphite or pencil marks, crosshatching, varied line weight, visible construction lines, and human imperfection.",
      composition:
        "Keep the framing readable but loose enough to preserve the spontaneous sketch quality.",
      lighting:
        "Use tonal shading selectively through graphite value and hatching rather than polished rendered light.",
      palette:
        "Mostly monochrome graphite or lightly toned paper with restrained accent if used.",
      materialsAndTextures:
        "Paper grain, graphite sheen, rough erasure traces, and hand pressure variation.",
      mustInclude:
        "A credible hand-drawn quality and lively line behavior.",
      avoid:
        "Avoid slick digital perfection, vector cleanliness, glossy painting, and overfinished realism.",
      negativePrompt:
        "Plastic smoothness, clean vector line, perfect gradients, photoreal shading, neon colors.",
    },
    "Let the drawing feel exploratory and human while staying intentional and skillful.",
    ["drawing", "graphite", "linework"],
  ),
  skill(
    "isometric",
    "Isometric illustration with geometric clarity and premium diagrammatic style.",
    240,
    {
      styleOverview:
        "An isometric illustration that feels precise, premium, and spatially clear.",
      visualHallmarks:
        "Consistent isometric angle, clean geometric forms, modular detail, and organized spatial layering.",
      composition:
        "Arrange objects as a readable isometric scene or system with strong structural logic.",
      lighting:
        "Use restrained stylized shading that enhances depth without breaking the isometric read.",
      palette:
        "Curated modern palette with clean surface separation and controlled accents.",
      materialsAndTextures:
        "Vector-like surfaces, subtle gradients, shadow planes, and polished diagrammatic finishes.",
      mustInclude:
        "Angle consistency and strong visual organization.",
      avoid:
        "Avoid perspective distortion, muddy texture realism, messy overlap, and inconsistent scale.",
      negativePrompt:
        "Broken geometry, realistic perspective lensing, chaotic shadows, noisy texture clutter, low-detail objects.",
    },
    "Keep the result precise, legible, and premium, somewhere between product illustration and editorial diagram.",
    ["diagram", "geometry", "system"],
  ),
  skill(
    "product",
    "Premium product-hero imagery with commercial polish and material fidelity.",
    250,
    {
      styleOverview:
        "A luxury-grade product visual that feels clean, intentional, and ready for an ad campaign.",
      visualHallmarks:
        "Hero framing, crisp silhouette, controlled reflections, elegant staging, and immaculate polish.",
      composition:
        "Give the product center-stage presence with a clear focal hierarchy and uncluttered support elements.",
      lighting:
        "Studio lighting with premium specular control, soft reflections, and dimensional separation.",
      palette:
        "Neutral or brand-led palette with restrained supporting color so the product remains dominant.",
      materialsAndTextures:
        "Glass, brushed metal, soft-touch plastic, paper, liquid, or fabric rendered with believable material fidelity.",
      mustInclude:
        "Commercial polish and strong product desirability.",
      avoid:
        "Avoid chaotic props, muddy backgrounds, cheap stock-photo lighting, and overbusy compositions.",
      negativePrompt:
        "Low-end ecommerce lighting, flat shadows, sloppy reflections, clutter, warped product shape, fingerprints.",
    },
    "Make it feel like a premium launch visual or luxury storefront hero shot.",
    ["commercial", "hero", "advertising"],
  ),
  skill(
    "architecture",
    "Architectural visualization or diagram with structure, material clarity, and spatial logic.",
    260,
    {
      styleOverview:
        "An architectural image that communicates structure, material intent, and spatial design with professional clarity.",
      visualHallmarks:
        "Disciplined lines, material articulation, structural relationships, and convincing built-form logic.",
      composition:
        "Frame to highlight form, circulation, layers, or construction logic depending on the subject.",
      lighting:
        "Use light to reveal volume and materiality without sacrificing architectural readability.",
      palette:
        "Concrete neutrals, glass reflections, timber warmth, muted site colors, and disciplined accent use.",
      materialsAndTextures:
        "Concrete, steel, glass, timber, section-line conventions, and architectural presentation textures.",
      mustInclude:
        "A strong architectural read and clear material/structural logic.",
      avoid:
        "Avoid fantasy chaos, decorative clutter, warped buildings, and camera distortion that breaks credibility.",
      negativePrompt:
        "Bent lines, impossible structure, muddy materials, cartoon rendering, cheap HDR sky, inconsistent perspective.",
    },
    "The image should feel like serious architecture communication, whether diagrammatic or atmospheric.",
    ["building", "structure", "spatial"],
  ),
  skill(
    "infographic",
    "Editorial infographic illustration with clear sections and educational layout.",
    270,
    {
      styleOverview:
        "An educational editorial visual that organizes information into a polished illustrated infographic composition.",
      visualHallmarks:
        "Central hero subject, supporting panels, clear sectioning, annotated clusters, and structured hierarchy.",
      composition:
        "Use a magazine-like layout with a dominant central image and smaller supporting explanatory scenes or panels.",
      lighting:
        "Keep lighting clean and readable so the layout remains clear.",
      palette:
        "Editorial palette with a neutral base and a few distinct category accents.",
      materialsAndTextures:
        "Clean illustration surfaces, crisp typography-ready spacing, and diagram-friendly visual simplification.",
      mustInclude:
        "Legible hierarchy and a sense that the image teaches something clearly.",
      avoid:
        "Avoid random UI widgets, corporate slide vibes, busy arrows everywhere, and generic template clutter.",
      negativePrompt:
        "Flowchart spam, unreadable detail, chaotic labels, cluttered icon soup, muddy hierarchy.",
    },
    "Make it feel like a premium magazine explainer page with visual discipline and strong educational clarity.",
    ["editorial", "explainer", "layout"],
  ),
];

export const styleSkillSuggestions = builtInSkills
  .filter((skillDefinition) => skillDefinition.category === "style")
  .slice(0, 6);
