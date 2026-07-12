import type { Participant } from "../types";

export const REFERENCE_PARTICIPANTS: readonly Participant[] = [
  {
    id: "lyla",
    slug: "lyla",
    name: "Lyla",
    abbreviation: "L",
    displayOrder: 1,
  },
  {
    id: "shiyu",
    slug: "shiyu",
    name: "Shiyu",
    abbreviation: "S",
    displayOrder: 2,
  },
  { id: "ivy", slug: "ivy", name: "Ivy", abbreviation: "Y", displayOrder: 3 },
  { id: "xun", slug: "xun", name: "Xun", abbreviation: "X", displayOrder: 4 },
  {
    id: "houji-yujin",
    slug: "houji-and-yujin",
    name: "Houji & Yujin",
    abbreviation: "H&J",
    displayOrder: 5,
  },
];
