import type { ReactNode } from "react";
import type { BiomeId } from "@unify/shared";

/** A little flat illustration of each biome, drawn on a 100 × 100 canvas. */
export function BiomeIcon({ biome, className }: { biome: BiomeId; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {SCENES[biome]}
    </svg>
  );
}

const Cloud = ({ x, y }: { x: number; y: number }) => (
  <g fill="#ffffff" opacity="0.9">
    <ellipse cx={x} cy={y} rx="9" ry="3.5" />
    <ellipse cx={x - 3} cy={y - 2} rx="4.5" ry="3" />
    <ellipse cx={x + 3} cy={y - 2.5} rx="4" ry="3" />
  </g>
);

const CITY_WINDOWS: Array<[number, number]> = [
  [10, 58], [15, 58], [10, 65], [15, 65], [10, 72], [15, 72], [10, 79], [15, 79],
  [79, 50], [85, 50], [79, 57], [85, 57], [79, 64], [85, 64], [79, 71], [85, 71], [79, 78], [85, 78],
];

/** Rows of book spines: [x, width, height, color]. */
const SHELVES: Array<{ y: number; books: Array<[number, number, number, string]> }> = [
  {
    y: 28,
    books: [
      [10, 5, 15, "#7d5a3c"], [15.5, 5, 15, "#7d5a3c"], [21, 5, 15, "#7d5a3c"], [27, 6, 18, "#c2ae8a"],
      [33.5, 6, 18, "#c2ae8a"], [43, 5, 14, "#3f4a55"], [48.5, 5, 14, "#3f4a55"], [54, 5, 14, "#3f4a55"],
      [59.5, 5, 14, "#3f4a55"], [69, 6, 17, "#6a3a32"], [75.5, 6, 17, "#6a3a32"], [82, 5, 15, "#d3c6a8"],
    ],
  },
  {
    y: 52,
    books: [
      [10, 6, 17, "#d3c6a8"], [16.5, 6, 17, "#d3c6a8"], [23, 6, 17, "#d3c6a8"], [32, 5, 15, "#4d5544"],
      [37.5, 5, 15, "#4d5544"], [43, 5, 15, "#4d5544"], [48.5, 5, 18, "#8f7050"], [54, 5, 18, "#8f7050"],
      [64, 6, 14, "#34302c"], [70.5, 6, 14, "#34302c"], [77, 5, 17, "#a88d68"], [82.5, 5, 17, "#a88d68"],
    ],
  },
];

const SCENES: Record<BiomeId, ReactNode> = {
  night_city: (
    <>
      <rect width="100" height="100" fill="#a4d4f1" />
      <Cloud x={22} y={20} />
      <Cloud x={80} y={30} />
      {/* Buildings either side of the tower. */}
      <rect x="7" y="52" width="16" height="42" fill="#8d8f95" />
      <rect x="75" y="44" width="17" height="50" fill="#5b93b3" />
      <rect x="21" y="68" width="16" height="26" fill="#e0bf6a" />
      <rect x="62" y="64" width="15" height="30" fill="#ddd6c6" />
      {CITY_WINDOWS.map(([x, y]) => (
        <rect key={`${x}:${y}`} x={x} y={y} width="3.4" height="4" fill="#2e3440" />
      ))}
      {/* The tower: legs, then a narrowing lattice with white bands and two lookout decks. */}
      <polygon points="31,94 43,94 47,62 53,62 57,94 69,94 57,46 53.5,28 51.2,6 48.8,6 46.5,28 43,46" fill="#d6372b" />
      <rect x="46.2" y="31" width="7.6" height="5" fill="#ffffff" />
      <rect x="47.8" y="16" width="4.4" height="4" fill="#ffffff" />
      <rect x="43.5" y="25.5" width="13" height="3" fill="#3f7f9b" />
      <rect x="39.5" y="44" width="21" height="4" fill="#3f7f9b" />
      <rect y="92" width="100" height="8" fill="#b9b4a8" />
    </>
  ),
  highlands: (
    <>
      <rect width="100" height="100" fill="#a4d4f1" />
      <circle cx="80" cy="18" r="8" fill="#ffe08a" />
      <Cloud x={52} y={16} />
      <path d="M0 52 Q 18 26 44 44 T 100 46 V100 H0 Z" fill="#8cbf66" />
      <path d="M0 66 Q 28 42 60 66 T 100 62 V100 H0 Z" fill="#6aa84f" />
      <path d="M0 84 Q 46 66 100 82 V100 H0 Z" fill="#558f3f" />
      {/* The lone tree on the hill. */}
      <rect x="24" y="36" width="3.4" height="13" fill="#6b4a2f" />
      <circle cx="25.5" cy="31" r="9" fill="#3f7d3a" />
      <circle cx="19.5" cy="35" r="5.5" fill="#4a8a3f" />
      <circle cx="31.5" cy="35" r="5.5" fill="#4a8a3f" />
      {/* Pines. */}
      <polygon points="80,44 72,62 88,62" fill="#2f6b3a" />
      <polygon points="80,36 74,50 86,50" fill="#367034" />
      <polygon points="92,50 86,64 98,64" fill="#2f6b3a" />
      {/* The lake. */}
      <ellipse cx="50" cy="84" rx="27" ry="9" fill="#e4d6a8" />
      <ellipse cx="50" cy="84" rx="23" ry="6.8" fill="#4f9fcb" />
      <ellipse cx="44" cy="83" rx="7" ry="1.3" fill="#a9d9ee" />
    </>
  ),
  beach: (
    <>
      <rect width="100" height="100" fill="#a4dcf5" />
      <circle cx="26" cy="20" r="9" fill="#ffd85a" />
      <Cloud x={72} y={18} />
      <rect y="40" width="100" height="24" fill="#2fa8c9" />
      <rect y="40" width="100" height="6" fill="#1c7fb0" />
      <path d="M0 60 Q 16 55 32 60 T 64 60 T 100 58 V100 H0 Z" fill="#ffffff" />
      <path d="M0 63 Q 16 58 32 63 T 64 63 T 100 61 V100 H0 Z" fill="#efdcae" />
      {/* A palm leaning in from the right. */}
      <path d="M90 94 Q 88 66 72 46" stroke="#8b6b47" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M72 46 Q 58 40 48 50 Q 62 46 72 46 Z" fill="#4f9a3f" />
      <path d="M72 46 Q 64 30 52 30 Q 64 36 72 46 Z" fill="#5fa945" />
      <path d="M72 46 Q 78 30 92 30 Q 80 36 72 46 Z" fill="#458f3a" />
      <path d="M72 46 Q 88 42 96 54 Q 84 48 72 46 Z" fill="#4f9a3f" />
      {/* A striped parasol and a beach chair. */}
      <rect x="32" y="56" width="2" height="30" fill="#e9e2d4" />
      <path d="M13 58 A 20 15 0 0 1 53 58 Z" fill="#e8694f" />
      <path d="M23 58 Q 25 47 33 43 Q 31 49 30.5 58 Z" fill="#fff8ec" />
      <path d="M43 58 Q 41 47 33 43 Q 35 49 35.5 58 Z" fill="#fff8ec" />
      <path d="M42 84 L 62 84 L 66 74 L 62.5 73 L 60 80 L 42 80 Z" fill="#3f9fc9" />
    </>
  ),
  library: (
    <>
      <rect width="100" height="100" fill="#4a3322" />
      {/* Two shelves of books, with a wooden frame. */}
      {SHELVES.map((shelf) => (
        <g key={shelf.y}>
          {shelf.books.map(([x, width, height, color]) => (
            <rect key={x} x={x} y={shelf.y - height} width={width} height={height} fill={color} />
          ))}
          <rect x="6" y={shelf.y} width="88" height="3.4" fill="#8a5f38" />
        </g>
      ))}
      {/* A book that's slumped against its neighbors. */}
      <rect x="66" y="10" width="4.6" height="16" fill="#8f7050" transform="rotate(-14 68 26)" />
      <rect x="6" y="6" width="4" height="50" fill="#8a5f38" />
      <rect x="90" y="6" width="4" height="50" fill="#8a5f38" />
      <rect x="6" y="6" width="88" height="4" fill="#8a5f38" />
      {/* A round study table with a green reading lamp and an open book. */}
      <rect y="62" width="100" height="38" fill="#a9774a" />
      <rect x="46" y="82" width="8" height="14" fill="#5f3f26" />
      <ellipse cx="50" cy="96" rx="15" ry="3" fill="#5f3f26" />
      <ellipse cx="50" cy="79" rx="36" ry="9" fill="#744c2c" />
      <rect x="49" y="66" width="2" height="11" fill="#b08d4f" />
      <ellipse cx="50" cy="77" rx="5" ry="1.6" fill="#b08d4f" />
      <path d="M39 68 Q 50 54 61 68 Z" fill="#3f6650" />
      <path d="M22 79 L 30 76.5 L 34 79 L 26 81.5 Z" fill="#f2ecdc" />
      <path d="M66 77 L 76 77 L 78 80.5 L 68 80.5 Z" fill="#6a3a32" />
    </>
  ),
};
