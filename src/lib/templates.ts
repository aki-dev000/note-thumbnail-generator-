export type Template = {
  id: string;
  name: string;
  searchKeywords: string[];
  overlayColor: string;
  textColor: string;
  textShadow: boolean;
  fontWeight: string;
};

export const templates: Template[] = [
  {
    id: "nature-calm",
    name: "自然・穏やか",
    searchKeywords: ["nature", "landscape", "peaceful", "green"],
    overlayColor: "rgba(0, 0, 0, 0.45)",
    textColor: "#ffffff",
    textShadow: true,
    fontWeight: "bold",
  },
  {
    id: "city-modern",
    name: "都市・モダン",
    searchKeywords: ["city", "urban", "architecture", "modern"],
    overlayColor: "rgba(10, 20, 40, 0.55)",
    textColor: "#ffffff",
    textShadow: true,
    fontWeight: "bold",
  },
  {
    id: "tech-digital",
    name: "テクノロジー",
    searchKeywords: ["technology", "digital", "abstract", "blue"],
    overlayColor: "rgba(0, 30, 60, 0.6)",
    textColor: "#e0f0ff",
    textShadow: true,
    fontWeight: "bold",
  },
  {
    id: "warm-life",
    name: "暮らし・温かみ",
    searchKeywords: ["home", "cozy", "lifestyle", "warm"],
    overlayColor: "rgba(80, 30, 0, 0.4)",
    textColor: "#fff8f0",
    textShadow: true,
    fontWeight: "bold",
  },
  {
    id: "minimal-white",
    name: "ミニマル・明るい",
    searchKeywords: ["minimal", "white", "clean", "simple"],
    overlayColor: "rgba(255, 255, 255, 0.5)",
    textColor: "#222222",
    textShadow: false,
    fontWeight: "bold",
  },
];
