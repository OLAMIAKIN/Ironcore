import qrcode from "qrcode-generator";
import { cn } from "@/lib/cn";

/** Quiet zone, in modules. The spec asks for four on every side. */
const MARGIN = 4;

/**
 * Builds the module matrix once per value. Error correction is set to "M":
 * door codes are short, so the extra redundancy costs almost no modules and
 * survives a scuffed phone screen under a front-desk camera.
 */
function matrixOf(value: string): boolean[][] {
  const code = qrcode(0, "M");
  code.addData(value, "Byte");
  code.make();

  const count = code.getModuleCount();
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) => code.isDark(row, column)),
  );
}

/**
 * A real, scannable QR code rendered as SVG — no canvas, no image request, and
 * it stays crisp at any size because the modules are whole units in the
 * viewBox.
 */
export function QrCode({
  value,
  className = "size-[180px]",
  label = "Membership code",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const modules = matrixOf(value);
  const size = modules.length + MARGIN * 2;

  return (
    <div
      className={cn(
        "mx-auto flex items-center justify-center rounded-xl bg-white p-3.5",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full"
        role="img"
        aria-label={label}
        shapeRendering="crispEdges"
      >
        <rect width={size} height={size} fill="#fff" />
        <g fill="#1C1E1F">
          {modules.map((row, y) =>
            row.map((dark, x) =>
              dark ? (
                <rect
                  key={`${x}-${y}`}
                  x={x + MARGIN}
                  y={y + MARGIN}
                  width={1}
                  height={1}
                />
              ) : null,
            ),
          )}
        </g>
      </svg>
    </div>
  );
}
