import { TrendingUp, Radio, Swords, Crown, Zap } from "lucide-react";
import { buildSeries } from "./buildSeries.js";

export const MILESTONES = [
  { key: "comeback", label: "Comeback", icon: TrendingUp, color: "--eco" },
  {
    key: "closeFinish",
    label: "Photo finish",
    icon: Radio,
    color: "--close",
  },
  { key: "bigBattle", label: "Big battle", icon: Swords, color: "--combat" },
  { key: "upset", label: "Upset", icon: Crown, color: "--upset" },
  { key: "ecoRace", label: "Fast start", icon: Zap, color: "--eco" },
];

export const COLORS = {
  bg: "#0b0f0d",
  panel: "#121815",
  panel2: "#182019",
  line: "#233029",
  ink: "#e7ece7",
  muted: "#7c8f86",
  faint: "#4b5a53",
  eco: "#4fd1a5",
  combat: "#e2543d",
  upset: "#d9a441",
  close: "#6fa8dc",
};

export const GEX_API_BASE = "https://gex.honu.pw";

export const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');";

export const CUMULATIVE = true;
export const FRAMES_PER_SECOND = 30;
export const GAMEMODES = {
  0: "Unknown", 1: "Duel", 2: "Small Team", 3: "Large Team", 4: "FFA", 5: "Team FFA",
};

export const DEMO_MATCHES = [
  {
    id: "demo-comeback-01",
    map: "Quicksilver Remake",
    gamemode: "Large team",
    playerCount: 8,
    durationMin: 34,
    startTime: "2026-07-06T21:10:00Z",
    teamA: {
      name: "Ally Team 1",
      skill: 24.1,
      players: ["Firepl4y", "kranky", "Beherith"],
    },
    teamB: {
      name: "Ally Team 2",
      skill: 25.6,
      players: ["Nixtron", "vitucox", "Elysia"],
    },
    winner: "A",
    series: buildSeries([
      [0, 40, 40, 0, 0],
      [4, 120, 180, 20, 40],
      [8, 260, 420, 60, 150],
      [12, 400, 780, 130, 340],
      [16, 520, 1180, 220, 610],
      [20, 640, 1500, 340, 900],
      [24, 900, 1680, 520, 1050],
      [28, 1350, 1780, 900, 1180],
      [31, 1900, 1830, 1500, 1260],
      [34, 2400, 1860, 2200, 1310],
    ]),
  },
  {
    id: "demo-close-02",
    map: "All That Glitters",
    gamemode: "Duel",
    playerCount: 2,
    durationMin: 41,
    startTime: "2026-07-06T18:40:00Z",
    teamA: { name: "Ally Team 1", skill: 28.9, players: ["Skasi"] },
    teamB: { name: "Ally Team 2", skill: 29.4, players: ["Squirrel_"] },
    winner: "B",
    series: buildSeries([
      [0, 30, 30, 0, 0],
      [6, 180, 190, 30, 35],
      [12, 400, 420, 90, 100],
      [18, 700, 690, 210, 230],
      [24, 980, 1010, 420, 460],
      [30, 1300, 1340, 700, 760],
      [36, 1620, 1590, 1050, 1120],
      [41, 1880, 1900, 1400, 1460],
    ]),
  },
  {
    id: "demo-stomp-03",
    map: "Red Comet",
    gamemode: "Small team",
    playerCount: 4,
    durationMin: 18,
    startTime: "2026-07-06T15:05:00Z",
    teamA: { name: "Ally Team 1", skill: 12.0, players: ["scrub1", "scrub2"] },
    teamB: {
      name: "Ally Team 2",
      skill: 26.5,
      players: ["Nixtron", "Beherith"],
    },
    winner: "B",
    series: buildSeries([
      [0, 30, 30, 0, 0],
      [4, 60, 200, 5, 60],
      [8, 90, 520, 15, 220],
      [12, 110, 900, 20, 480],
      [16, 130, 1300, 25, 780],
      [18, 140, 1500, 25, 900],
    ]),
  },
  {
    id: "demo-upset-04",
    map: "Delta Siege Dry",
    gamemode: "Duel",
    playerCount: 2,
    durationMin: 27,
    startTime: "2026-07-06T12:20:00Z",
    teamA: { name: "Ally Team 1", skill: 14.2, players: ["risingstar99"] },
    teamB: { name: "Ally Team 2", skill: 27.8, players: ["Elysia"] },
    winner: "A",
    series: buildSeries([
      [0, 25, 25, 0, 0],
      [4, 90, 140, 10, 30],
      [8, 190, 340, 40, 100],
      [12, 340, 560, 110, 240],
      [16, 560, 760, 260, 420],
      [20, 870, 900, 520, 640],
      [24, 1240, 980, 900, 760],
      [27, 1560, 1010, 1280, 800],
    ]),
  },
  {
    id: "demo-turtle-05",
    map: "Supreme Isthmus",
    gamemode: "Large team",
    playerCount: 8,
    durationMin: 52,
    startTime: "2026-07-06T09:00:00Z",
    teamA: { name: "Ally Team 1", skill: 20.3, players: ["kranky", "vitucox"] },
    teamB: {
      name: "Ally Team 2",
      skill: 21.0,
      players: ["Firepl4y", "Squirrel_"],
    },
    winner: "A",
    series: buildSeries([
      [0, 30, 30, 0, 0],
      [10, 400, 420, 30, 40],
      [20, 900, 950, 90, 100],
      [30, 1600, 1650, 180, 200],
      [40, 2400, 2300, 260, 290],
      [52, 3200, 2900, 340, 360],
    ]),
  },
  {
    id: "demo-ecorace-06",
    map: "Zed",
    gamemode: "Duel",
    playerCount: 2,
    durationMin: 22,
    startTime: "2026-07-05T22:15:00Z",
    teamA: { name: "Ally Team 1", skill: 25.0, players: ["Beherith"] },
    teamB: { name: "Ally Team 2", skill: 24.8, players: ["Skasi"] },
    winner: "A",
    series: buildSeries([
      [0, 40, 40, 0, 0],
      [2, 210, 90, 10, 5],
      [4, 480, 200, 30, 15],
      [8, 780, 520, 90, 60],
      [12, 1020, 880, 220, 190],
      [16, 1240, 1180, 480, 460],
      [19, 1500, 1460, 900, 880],
      [22, 1820, 1700, 1400, 1350],
    ]),
  },
  {
    id: "demo-quiet-07",
    map: "Comet Catcher Remake",
    gamemode: "Small team",
    playerCount: 4,
    durationMin: 24,
    startTime: "2026-07-05T19:30:00Z",
    teamA: {
      name: "Ally Team 1",
      skill: 18.0,
      players: ["scrub1", "risingstar99"],
    },
    teamB: { name: "Ally Team 2", skill: 19.4, players: ["vitucox", "kranky"] },
    winner: "B",
    series: buildSeries([
      [0, 30, 30, 0, 0],
      [6, 220, 260, 20, 25],
      [12, 480, 540, 60, 70],
      [18, 760, 830, 130, 150],
      [24, 1020, 1120, 220, 250],
    ]),
  },
];
