import { z } from "zod";

export const themeConfigSchema = z.object({
  mode: z.enum(["light", "dark"]).describe("Light or dark color mode"),
  background: z.string().describe("HSL value for page background, e.g. '0 0% 100%'"),
  foreground: z.string().describe("HSL value for main text color"),
  card: z.string().describe("HSL value for card backgrounds"),
  cardForeground: z.string().describe("HSL value for card text"),
  primary: z.string().describe("HSL value for primary accent color (buttons, links)"),
  primaryForeground: z.string().describe("HSL value for text on primary-colored elements"),
  secondary: z.string().describe("HSL value for secondary accent"),
  secondaryForeground: z.string().describe("HSL value for text on secondary elements"),
  muted: z.string().describe("HSL value for muted/subtle backgrounds"),
  mutedForeground: z.string().describe("HSL value for muted/secondary text"),
  accent: z.string().describe("HSL value for accent highlights"),
  accentForeground: z.string().describe("HSL value for text on accent elements"),
  border: z.string().describe("HSL value for borders and dividers"),
  input: z.string().describe("HSL value for input field borders"),
  ring: z.string().describe("HSL value for focus ring color"),
  radius: z.string().describe("Border radius value, e.g. '0.5rem', '0.75rem', '1rem'"),
  fontScale: z.number().min(0.75).max(1.5).describe("Font size multiplier (1 = default, 1.25 = larger)"),
});

export const layoutConfigSchema = z.object({
  maxWidth: z.enum(["4xl", "5xl", "6xl", "7xl", "full"]).describe("Maximum content width"),
  contentDensity: z.enum(["compact", "comfortable", "spacious"]).describe("Content density / spacing"),
  cardStyle: z.enum(["minimal", "default", "elevated"]).describe("Card visual style"),
  gridColumns: z.number().min(1).max(4).describe("Number of grid columns for card layouts"),
  navPosition: z.enum(["top", "sidebar"]).describe("Navigation position"),
});

export const visibilityConfigSchema = z.object({
  showMapEmbeds: z.boolean().describe("Show map embeds on event cards"),
  showConfidenceScores: z.boolean().describe("Show AI confidence scores"),
  showSourceInfo: z.boolean().describe("Show event source attribution"),
  showAgeRange: z.boolean().describe("Show age range info on events"),
  showPricing: z.boolean().describe("Show pricing information on events"),
  navItems: z.array(z.object({
    href: z.string(),
    label: z.string(),
    visible: z.boolean(),
  })).describe("Navigation items with visibility and order"),
});

export const uiConfigSchema = z.object({
  theme: themeConfigSchema,
  layout: layoutConfigSchema,
  visibility: visibilityConfigSchema,
});

export type UIConfig = z.infer<typeof uiConfigSchema>;
export type ThemeConfig = z.infer<typeof themeConfigSchema>;
export type LayoutConfig = z.infer<typeof layoutConfigSchema>;
export type VisibilityConfig = z.infer<typeof visibilityConfigSchema>;
