import React from "react";
import { Coordinates, usePaneContext, useTransformContext } from "mafs";

const toSuperscript = (num: string) => {
  const map: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '.': '·'
  };
  return num.split('').map(c => map[c] || c).join('');
};

// Rounds a raw spacing (in world units) to a "nice" number for grid lines:
// 1, 2, 5, 10, 20, 50, 100, ... (or the equivalent below 1).
function getNiceStep(targetSpacing: number): number {
  const exponent = Math.floor(Math.log10(targetSpacing));
  const fraction = targetSpacing / Math.pow(10, exponent);

  let niceFraction: number;
  if (fraction <= 1.5) niceFraction = 1;
  else if (fraction <= 3.5) niceFraction = 2;
  else if (fraction <= 7.5) niceFraction = 5;
  else niceFraction = 10;

  return niceFraction * Math.pow(10, exponent);
}

// Treats `base` as the smallest meaningful granularity (the user's configured
// axis step) and scales it up by a nice multiple (1, 2, 5, 10, 20, 50, ...) so
// consecutive labels stay ~targetSpacing world-units apart. Never goes denser
// than `base`. This is what keeps the axis from collapsing into overlapping
// labels as you zoom out (Desmos/GeoGebra-style), while zooming in / normal
// zoom levels are left untouched.
function getNiceStepFromBase(base: number, targetSpacing: number): number {
  if (!isFinite(base) || base <= 0) base = 1;
  const ratio = targetSpacing / base;
  if (ratio <= 1) return base;
  return base * getNiceStep(ratio);
}

// Renders very large/small magnitudes as "coef×10^exp" (superscript) instead
// of long decimal strings, so labels stay short as the view zooms out.
function formatMagnitude(n: number, decimals: number): React.ReactNode {
  const absN = Math.abs(n);
  if (absN > 0 && (absN >= 1e6 || absN <= 1e-4)) {
    const [coef, expStr] = absN.toExponential(decimals).split("e");
    const cleanCoef = parseFloat(coef);
    const sign = n < 0 ? "-" : "";
    const supExp = toSuperscript(parseInt(expStr, 10).toString());
    return `${sign}${cleanCoef === 1 ? "" : cleanCoef + "×"}10${supExp}`;
  }
  return parseFloat(n.toPrecision(12));
}

export function createAxisLabelFormatter(options: {
  axisDecimals: number;
  axisThousandsSep: boolean;
  axisPrefix: string;
  axisSuffix: string;
}) {
  const { axisDecimals, axisThousandsSep, axisPrefix, axisSuffix } = options;

  return (rawN: number, adaptiveStep?: number) => {
    // Keep floating point math from destroying readability
    let n = parseFloat(rawN.toPrecision(12));

    // Clamp microscopic floats to zero
    if (Math.abs(n) < 1e-12) n = 0;

    if (n === 0) return 0;

    // As the grid step shrinks below 1, show enough decimals for the labels
    // to actually differ from their neighbors (e.g. step 0.01 needs 2 decimals).
    let effectiveDecimals = axisDecimals;
    if (adaptiveStep !== undefined && adaptiveStep > 0) {
      const stepLog = Math.log10(adaptiveStep);
      if (stepLog < 0) {
        effectiveDecimals = Math.max(axisDecimals, Math.ceil(Math.abs(stepLog)));
      }
    }

    const absN = Math.abs(n);
    let baseLabel: React.ReactNode;
    if (absN >= 1e6 || absN <= 1e-4) {
      baseLabel = formatMagnitude(n, axisDecimals);
    } else {
      const rounded = Number(n.toFixed(effectiveDecimals));
      baseLabel = axisThousandsSep ? rounded.toLocaleString() : rounded;
    }

    if (typeof baseLabel === "string" || typeof baseLabel === "number") {
      return `${axisPrefix}${baseLabel}${axisSuffix}`;
    }

    return (
      <React.Fragment>
        {axisPrefix}
        {baseLabel}
        {axisSuffix}
      </React.Fragment>
    );
  };
}

interface AdaptiveGridProps {
  gridType: string;
  gridSubdivisions: number;
  parsedAxisStep: number;
  axisAutoFit: boolean;
  axisDecimals: number;
  axisThousandsSep: boolean;
  axisPrefix: string;
  axisSuffix: string;
}

const AdaptiveGridInner: React.FC<AdaptiveGridProps> = ({
  gridType,
  gridSubdivisions,
  parsedAxisStep,
  axisAutoFit,
  axisDecimals,
  axisThousandsSep,
  axisPrefix,
  axisSuffix,
}) => {
  usePaneContext();
  const { viewTransform } = useTransformContext();

  const scaleX = viewTransform[0];
  const scaleY = viewTransform[4];

  // We want labels approximately 80 pixels apart (major grid lines).
  const targetMathSpacingX = 80 / scaleX;
  const targetMathSpacingY = 80 / Math.abs(scaleY);

  const effectiveStepX = axisAutoFit
    ? getNiceStepFromBase(parsedAxisStep, targetMathSpacingX)
    : parsedAxisStep;
  const effectiveStepY = axisAutoFit
    ? getNiceStepFromBase(parsedAxisStep, targetMathSpacingY)
    : parsedAxisStep;

  const getAxisLabel = React.useMemo(() => createAxisLabelFormatter({
    axisDecimals,
    axisThousandsSep,
    axisPrefix,
    axisSuffix,
  }), [axisDecimals, axisThousandsSep, axisPrefix, axisSuffix]);

  const dynamicLabelsX = (n: number) => {
    const isLabelStep = Math.abs((n / effectiveStepX) - Math.round(n / effectiveStepX)) < 1e-4;
    if (!isLabelStep) return "";
    return getAxisLabel(n, effectiveStepX);
  };

  const dynamicLabelsY = (n: number) => {
    const isLabelStep = Math.abs((n / effectiveStepY) - Math.round(n / effectiveStepY)) < 1e-4;
    if (!isLabelStep) return "";
    return getAxisLabel(n, effectiveStepY);
  };

  if (gridType === "cartesian") {
    return (
      <Coordinates.Cartesian
        xAxis={{ lines: effectiveStepX, labels: dynamicLabelsX }}
        yAxis={{ lines: effectiveStepY, labels: dynamicLabelsY }}
        subdivisions={gridSubdivisions || 5}
      />
    );
  }

  if (gridType === "polar") {
    const targetMathSpacing = 80 / scaleX;
    const effectiveStep = axisAutoFit
      ? getNiceStepFromBase(parsedAxisStep, targetMathSpacing)
      : parsedAxisStep;

    const dynamicLabelsPolar = (n: number) => {
      const isLabelStep = Math.abs((n / effectiveStep) - Math.round(n / effectiveStep)) < 1e-4;
      if (!isLabelStep) return "";
      return getAxisLabel(n, effectiveStep);
    };

    return (
      <Coordinates.Polar
        xAxis={{ labels: dynamicLabelsPolar }}
        yAxis={{ labels: dynamicLabelsPolar }}
        lines={effectiveStep}
        subdivisions={gridSubdivisions || 5}
      />
    );
  }

  return null;
}

// All props are primitives, so this skips re-rendering the grid on every animation frame.
// Pan/zoom still updates it: it reads the view transform from context internally.
export const AdaptiveGrid = React.memo(AdaptiveGridInner);
