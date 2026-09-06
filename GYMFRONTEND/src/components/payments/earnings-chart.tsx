"use client";

import { useState } from "react";
import { naira, nairaCompact } from "@/lib/format";

/**
 * What the gym earned per day — its own share, which is the only figure the
 * owner's screens deal in. One series, so there is no legend (the heading names
 * it) and only the best day carries a printed value; the rest are on hover.
 */

export type EarningsPoint = { date: string; label: string; amount: number };

const WIDTH = 640;
const HEIGHT = 210;
const PAD = { top: 18, right: 8, bottom: 26, left: 44 };

/** A bar with its top two corners rounded, anchored on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

export function EarningsChart({ data }: { data: EarningsPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-helper text-steel-soft">
        No payments in this period yet.
      </p>
    );
  }

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const peak = Math.max(...data.map((day) => day.amount), 1);
  const scale = niceCeiling(peak);
  const step = plotWidth / data.length;
  const barWidth = Math.min(28, Math.max(6, step - 6));
  const peakIndex = data.findIndex((day) => day.amount === peak);

  const ticks = [0, scale / 2, scale];
  const active = hover === null ? null : (data[hover] ?? null);

  function xOf(index: number): number {
    return PAD.left + index * step + (step - barWidth) / 2;
  }

  function yOf(value: number): number {
    return PAD.top + plotHeight - (value / scale) * plotHeight;
  }

  return (
    // Below ~560px the day labels would be unreadable, so the plot keeps its
    // width and the card scrolls it instead of shrinking the type.
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="relative min-w-[560px]">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Earnings per day, ${data[0]?.label} to ${data.at(-1)?.label}. Best day ${naira(peak)}.`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                className="stroke-line"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={yOf(tick) + 4}
                textAnchor="end"
                className="fill-steel-soft font-mono text-[10px]"
              >
                {tick === 0 ? "0" : nairaCompact(tick)}
              </text>
            </g>
          ))}

          {data.map((day, index) => {
            const height = Math.max(2, (day.amount / scale) * plotHeight);
            const y = PAD.top + plotHeight - height;
            const labelEvery = Math.ceil(data.length / 8);

            return (
              <g
                key={day.date}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
              >
                {/* Hit target is the whole column, not just the bar. */}
                <rect
                  x={PAD.left + index * step}
                  y={PAD.top}
                  width={step}
                  height={plotHeight}
                  fill="transparent"
                />
                <path
                  d={barPath(xOf(index), y, barWidth, height)}
                  className={
                    hover === null || hover === index
                      ? "fill-valid"
                      : "fill-valid opacity-45"
                  }
                />
                {index === peakIndex && (
                  <text
                    x={xOf(index) + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className="fill-ink font-mono text-[10px] font-bold"
                  >
                    {nairaCompact(day.amount)}
                  </text>
                )}
                {index % labelEvery === 0 && (
                  <text
                    x={xOf(index) + barWidth / 2}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-steel-soft text-[10px]"
                  >
                    {day.label}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={PAD.top + plotHeight}
            y2={PAD.top + plotHeight}
            className="stroke-line-strong"
            strokeWidth={1}
          />
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-ctl bg-ink px-3 py-2 text-white shadow-lg"
            style={{
              left: `${((xOf(hover ?? 0) + barWidth / 2) / WIDTH) * 100}%`,
            }}
          >
            <p className="text-micro tracking-[0.5px] text-mist uppercase">
              {active.label}
            </p>
            <p className="font-mono text-sm font-bold">{naira(active.amount)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Rounds the axis top to something a person would draw by hand. */
function niceCeiling(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.max(magnitude, Math.ceil(value / (magnitude / 2)) * (magnitude / 2));
}
