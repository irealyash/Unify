"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Deterministic classroom-role sample for the landing visualization.
 * Illustrative only — not live product data.
 */
const PEOPLE = [
  { id: "p1", name: "Alex", role: "Organizer", angle: -90 },
  { id: "p2", name: "Jordan", role: "Writer", angle: -18 },
  { id: "p3", name: "Sam", role: "Presenter", angle: 54 },
  { id: "p4", name: "Riley", role: "Researcher", angle: 126 },
  { id: "p5", name: "Casey", role: "Builder", angle: 198 },
] as const;

const CX = 200;
const CY = 168;
const RADIUS = 96;

function polar(angleDeg: number, r = RADIUS) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + Math.cos(rad) * r,
    y: CY + Math.sin(rad) * r,
  };
}

export function MatchingIllustration({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const nodes = PEOPLE.map((person) => ({ ...person, ...polar(person.angle) }));

  return (
    <div
      className={
        className ??
        "relative aspect-[5/4] w-full overflow-hidden rounded-lg border border-border bg-card"
      }
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--foreground) 4%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 4%, transparent) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 48%, black 20%, transparent)",
        }}
      />

      <div className="absolute left-4 top-4 text-label">Illustrative</div>
      <div className="absolute right-4 top-4 text-[12px] text-muted-foreground">
        Working-style groups
      </div>

      <svg
        viewBox="0 0 400 320"
        className="relative z-10 h-full w-full"
        role="img"
        aria-label="Diagram of classmates forming a balanced project group"
      >
        {nodes.map((node) => (
          <motion.line
            key={`line-${node.id}`}
            x1={CX}
            y1={CY}
            x2={node.x}
            y2={node.y}
            stroke="currentColor"
            className="text-border"
            strokeWidth="1"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          />
        ))}

        <motion.g
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          <circle
            cx={CX}
            cy={CY}
            r="34"
            className="fill-muted stroke-border"
            strokeWidth="1"
          />
          <text
            x={CX}
            y={CY - 2}
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 11, fontWeight: 500 }}
          >
            Group
          </text>
          <text
            x={CX}
            y={CY + 12}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            pool
          </text>
        </motion.g>

        {nodes.map((node, index) => (
          <motion.g
            key={node.id}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.12 + index * 0.05 }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r="20"
              className="fill-card stroke-border"
              strokeWidth="1"
            />
            <text
              x={node.x}
              y={node.y + 4}
              textAnchor="middle"
              className="fill-foreground"
              style={{ fontSize: 11, fontWeight: 500 }}
            >
              {node.name.slice(0, 1)}
            </text>
            <text
              x={node.x}
              y={node.y + 36}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {node.role}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}
