import React from "react";
import { Coordinates, usePaneContext, useTransformContext } from "mafs";
import * as mathjs from "mathjs";

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

function gcd(a: number, b: number): number {
  a = Math.round(Math.abs(a));
  b = Math.round(Math.abs(b));
  while (b > 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

export function formatPiComplexLabel(params: {
  n: number;
  isComplex: boolean;
  axisPiSymbol: boolean;
  axisThousandsSep: boolean;
}): React.ReactNode | null {
  const { n, isComplex, axisPiSymbol, axisThousandsSep } = params;
  if (Math.abs(n) < 1e-12) return 0;

  // Format rational multiples of Pi if axisPiSymbol is enabled
  if (axisPiSymbol) {
    const ratio = n / Math.PI;
    const candidateDenominators = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
    for (const d of candidateDenominators) {
      const k = Math.round(ratio * d);
      if (Math.abs(ratio - k / d) < 1e-4) {
        if (k === 0) return 0;
        const g = gcd(Math.abs(k), d);
        const num = k / g;
        const den = d / g;
        const sign = num < 0 ? "-" : "";
        const absNum = Math.abs(num);
        const formattedNum = axisThousandsSep ? absNum.toLocaleString() : absNum.toString();

        const unit = isComplex ? "πi" : "π";

        if (den === 1) {
          return absNum === 1 ? `${sign}${unit}` : `${sign}${formattedNum}${unit}`;
        } else {
          return absNum === 1
            ? `${sign}${unit}/${den}`
            : `${sign}${formattedNum}${unit}/${den}`;
        }
      }
    }
  }

  // If not Pi formatted, but isComplex is enabled
  if (isComplex) {
    if (Math.abs(n - 1) < 1e-9) return "i";
    if (Math.abs(n - (-1)) < 1e-9) return "-i";
  }

  return null;
}

import { normalizeFilter } from "./mathHelpers";

export interface AxisLabelFormatterOptions {
  axisDecimals: number;
  axisThousandsSep: boolean;
  axisPrefix: string;
  axisSuffix: string;
  stepFilterExpr?: string;
  separateAxes?: boolean;
  axisPiSymbol?: boolean;
  axisComplexNotation?: boolean;
  axisFilterX?: "all" | "even" | "odd" | "custom";
  axisFilterY?: "all" | "even" | "odd" | "custom";
  axisCustomFilterX?: string;
  axisCustomFilterY?: string;
  axisPiSymbolX?: boolean;
  axisPiSymbolY?: boolean;
  axisComplexNotationX?: boolean;
  axisComplexNotationY?: boolean;
  axisComplexTarget?: "y" | "both";
}

export function createAxisLabelFormatter(options: AxisLabelFormatterOptions) {
  const {
    axisDecimals,
    axisThousandsSep,
    axisPrefix,
    axisSuffix,
    stepFilterExpr = "",
    separateAxes = false,
    axisPiSymbol = false,
    axisComplexNotation = false,
    axisFilterX = "all",
    axisFilterY = "all",
    axisCustomFilterX = "",
    axisCustomFilterY = "",
    axisPiSymbolX,
    axisPiSymbolY,
    axisComplexNotationX,
    axisComplexNotationY,
    axisComplexTarget = "y",
  } = options;

  let compiledStepFilter: mathjs.EvalFunction | null = null;
  if (stepFilterExpr && stepFilterExpr.trim()) {
    try {
      compiledStepFilter = mathjs.compile(normalizeFilter(stepFilterExpr.trim()));
    } catch {
      compiledStepFilter = null;
    }
  }

  let compiledFilterX: mathjs.EvalFunction | null = null;
  if (separateAxes && axisFilterX === "custom" && axisCustomFilterX && axisCustomFilterX.trim()) {
    try {
      compiledFilterX = mathjs.compile(normalizeFilter(axisCustomFilterX.trim()));
    } catch {
      compiledFilterX = null;
    }
  }

  let compiledFilterY: mathjs.EvalFunction | null = null;
  if (separateAxes && axisFilterY === "custom" && axisCustomFilterY && axisCustomFilterY.trim()) {
    try {
      compiledFilterY = mathjs.compile(normalizeFilter(axisCustomFilterY.trim()));
    } catch {
      compiledFilterY = null;
    }
  }


  return (rawN: number, adaptiveStep?: number, axis?: "x" | "y") => {
    // Keep floating point math from destroying readability
    let n = parseFloat(rawN.toPrecision(12));

    // Clamp microscopic floats to zero
    if (Math.abs(n) < 1e-12) n = 0;

    const currentAxis = axis || "x";

    // When separate axes is enabled, support odd/even/all/custom filters
    if (separateAxes) {
      const filter = currentAxis === "y" ? axisFilterY : axisFilterX;
      if (filter === "even") {
        const rounded = Math.round(n);
        if (Math.abs(n - rounded) < 1e-4) {
          if (rounded % 2 !== 0) return "";
        }
      } else if (filter === "odd") {
        const rounded = Math.round(n);
        if (Math.abs(n - rounded) < 1e-4) {
          if (rounded % 2 === 0) return "";
        }
      } else if (filter === "custom") {
        const compiled = currentAxis === "y" ? compiledFilterY : compiledFilterX;
        if (compiled) {
          try {
            const scope = { n, x: n, y: n, k: n, pi: Math.PI, e: Math.E };
            const res = compiled.evaluate(scope);
            if (res === false || res === 0) return "";
          } catch {
            // Ignore syntax/evaluation errors during typing
          }
        }
      }
    }

    // Global step filter check (applied when step size contains a filter, e.g. "n%5 == 0")
    if (compiledStepFilter) {
      try {
        const scope = { n, x: n, y: n, k: n, pi: Math.PI, e: Math.E };
        const res = compiledStepFilter.evaluate(scope);
        if (res === false || res === 0) return "";
      } catch {
        // Ignore syntax/evaluation errors during typing
      }
    }

    if (n === 0) return 0;

    let piSymbol = false;
    let isComplex = false;

    if (separateAxes) {
      piSymbol =
        currentAxis === "y"
          ? (axisPiSymbolY !== undefined ? axisPiSymbolY : axisPiSymbol)
          : (axisPiSymbolX !== undefined ? axisPiSymbolX : axisPiSymbol);
      isComplex =
        currentAxis === "y"
          ? (axisComplexNotationY !== undefined ? axisComplexNotationY : axisComplexNotation)
          : (axisComplexNotationX !== undefined
              ? axisComplexNotationX
              : axisComplexNotation && axisComplexTarget === "both");
    } else {
      // Normal mode: pi symbol applies to axis, complex notation applies to Y-axis only
      piSymbol = Boolean(axisPiSymbol);
      isComplex = currentAxis === "y" ? Boolean(axisComplexNotation) : false;
    }

    const piOrComplexLabel = formatPiComplexLabel({
      n,
      isComplex,
      axisPiSymbol: piSymbol,
      axisThousandsSep,
    });

    if (piOrComplexLabel !== null) {
      if (typeof piOrComplexLabel === "string" || typeof piOrComplexLabel === "number") {
        return `${axisPrefix}${piOrComplexLabel}${axisSuffix}`;
      }
      return (
        <React.Fragment>
          {axisPrefix}
          {piOrComplexLabel}
          {axisSuffix}
        </React.Fragment>
      );
    }

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

    const complexSuffix = isComplex ? "i" : "";

    if (typeof baseLabel === "string" || typeof baseLabel === "number") {
      return `${axisPrefix}${baseLabel}${complexSuffix}${axisSuffix}`;
    }

    return (
      <React.Fragment>
        {axisPrefix}
        {baseLabel}
        {complexSuffix}
        {axisSuffix}
      </React.Fragment>
    );
  };
}

export interface AdaptiveGridProps {
  gridType: string;
  gridSubdivisions: number;
  parsedAxisStep: number;
  stepFilterExpr?: string;
  axisAutoFit: boolean;
  axisDecimals: number;
  axisThousandsSep: boolean;
  axisPrefix: string;
  axisSuffix: string;
  separateAxes?: boolean;
  axisPiSymbol?: boolean;
  axisComplexNotation?: boolean;
  axisFilterX?: "all" | "even" | "odd" | "custom";
  axisFilterY?: "all" | "even" | "odd" | "custom";
  axisCustomFilterX?: string;
  axisCustomFilterY?: string;
  axisPiSymbolX?: boolean;
  axisPiSymbolY?: boolean;
  axisComplexNotationX?: boolean;
  axisComplexNotationY?: boolean;
  axisComplexTarget?: "y" | "both";
}

const AdaptiveGridInner: React.FC<AdaptiveGridProps> = ({
  gridType,
  gridSubdivisions,
  parsedAxisStep,
  stepFilterExpr,
  axisAutoFit,
  axisDecimals,
  axisThousandsSep,
  axisPrefix,
  axisSuffix,
  separateAxes = false,
  axisPiSymbol = false,
  axisComplexNotation = false,
  axisFilterX = "all",
  axisFilterY = "all",
  axisCustomFilterX = "",
  axisCustomFilterY = "",
  axisPiSymbolX,
  axisPiSymbolY,
  axisComplexNotationX,
  axisComplexNotationY,
  axisComplexTarget = "y",
}) => {
  usePaneContext();
  const { viewTransform } = useTransformContext();

  const scaleX = viewTransform[0];
  const scaleY = viewTransform[4];

  // We want labels approximately 80 pixels apart (major grid lines).
  const targetMathSpacingX = 80 / scaleX;
  const targetMathSpacingY = 80 / Math.abs(scaleY);

  const effectiveStepX = (axisAutoFit && !stepFilterExpr)
    ? getNiceStepFromBase(parsedAxisStep, targetMathSpacingX)
    : parsedAxisStep;
  const effectiveStepY = (axisAutoFit && !stepFilterExpr)
    ? getNiceStepFromBase(parsedAxisStep, targetMathSpacingY)
    : parsedAxisStep;

  const getAxisLabel = React.useMemo(
    () =>
      createAxisLabelFormatter({
        axisDecimals,
        axisThousandsSep,
        axisPrefix,
        axisSuffix,
        stepFilterExpr,
        separateAxes,
        axisPiSymbol,
        axisComplexNotation,
        axisFilterX,
        axisFilterY,
        axisCustomFilterX,
        axisCustomFilterY,
        axisPiSymbolX,
        axisPiSymbolY,
        axisComplexNotationX,
        axisComplexNotationY,
        axisComplexTarget,
      }),
    [
      axisDecimals,
      axisThousandsSep,
      axisPrefix,
      axisSuffix,
      stepFilterExpr,
      separateAxes,
      axisPiSymbol,
      axisComplexNotation,
      axisFilterX,
      axisFilterY,
      axisCustomFilterX,
      axisCustomFilterY,
      axisPiSymbolX,
      axisPiSymbolY,
      axisComplexNotationX,
      axisComplexNotationY,
      axisComplexTarget,
    ],
  );


  const dynamicLabelsX = (n: number) => {
    const isLabelStep = Math.abs((n / effectiveStepX) - Math.round(n / effectiveStepX)) < 1e-4;
    if (!isLabelStep) return "";
    return getAxisLabel(n, effectiveStepX, "x");
  };

  const dynamicLabelsY = (n: number) => {
    const isLabelStep = Math.abs((n / effectiveStepY) - Math.round(n / effectiveStepY)) < 1e-4;
    if (!isLabelStep) return "";
    return getAxisLabel(n, effectiveStepY, "y");
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
