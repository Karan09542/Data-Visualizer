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

export function createAxisLabelFormatter(options: {
  axisFilter: string;
  axisDecimals: number;
  axisThousandsSep: boolean;
  axisPrefix: string;
  axisSuffix: string;
  customAxisFilter: string;
  customAxisMapping: string;
}) {
  const {
    axisFilter,
    axisDecimals,
    axisThousandsSep,
    axisPrefix,
    axisSuffix,
    customAxisFilter,
    customAxisMapping,
  } = options;

  return (rawN: number, adaptiveStep?: number) => {
    // Keep floating point math from destroying readability globally
    let n = parseFloat(rawN.toPrecision(12));
    
    // Clamp microscopic floats to zero
    if (Math.abs(n) < 1e-12) n = 0;

    if (n === 0 && axisFilter !== "custom_mapping" && axisFilter !== "custom")
      return 0;

    let baseLabel: React.ReactNode = "";

    if (axisFilter === "all") {
      baseLabel = n;
    } else if (axisFilter === "even") {
      baseLabel = n % 2 === 0 ? n : "";
    } else if (axisFilter === "odd") {
      baseLabel = Math.abs(n % 2) === 1 ? n : "";
    } else if (axisFilter === "custom") {
      try {
        const res = mathjs.evaluate(customAxisFilter, { n });
        if (res) baseLabel = n;
      } catch {
        baseLabel = "";
      }
    } else if (axisFilter === "custom_mapping") {
      const linesStr = customAxisMapping.split("\n");
      for (const line of linesStr) {
        // Use either ':' or '->' or '→' as delimiter
        const delimiter = line.includes("→")
          ? "→"
          : line.includes("->")
            ? "->"
            : ":";
        const [k, ...vParts] = line.split(delimiter);
        if (vParts.length > 0 && parseFloat(k.trim()) === n) {
          baseLabel = vParts.join(delimiter).trim();
          break;
        }
      }
    } else if (axisFilter === "pi") {
      const fraction = n / Math.PI;
      const rounded = Math.round(fraction * 1000) / 1000;
      if (Math.abs(rounded) < 0.001) baseLabel = "0";
      else if (Math.abs(rounded - 1) < 0.001) baseLabel = "π";
      else if (Math.abs(rounded + 1) < 0.001) baseLabel = "-π";
      else {
        const d = 1000;
        const num = Math.round(fraction * d);
        const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
        const divisor = gcd(Math.abs(num), d);
        const simpNum = num / divisor;
        const simpDen = d / divisor;

        if (simpDen === 1) baseLabel = `${simpNum}π`;
        else if (simpNum === 1) baseLabel = `π/${simpDen}`;
        else if (simpNum === -1) baseLabel = `-π/${simpDen}`;
        else baseLabel = `${simpNum}π/${simpDen}`;
      }
    } else if (axisFilter === "euler") {
      const fraction = n / Math.E;
      const rounded = Math.round(fraction * 1000) / 1000;
      if (Math.abs(rounded) < 0.001) baseLabel = "0";
      else if (Math.abs(rounded - 1) < 0.001) baseLabel = "e";
      else if (Math.abs(rounded + 1) < 0.001) baseLabel = "-e";
      else {
        const d = 1000;
        const num = Math.round(fraction * d);
        const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
        const divisor = gcd(Math.abs(num), d);
        const simpNum = num / divisor;
        const simpDen = d / divisor;

        const supExp = toSuperscript(simpNum.toString());
        const subExp = toSuperscript(simpDen.toString()); 

        if (simpDen === 1) baseLabel = `e${supExp}`;
        else baseLabel = `e${toSuperscript((simpNum / simpDen).toString())}`;
      }
    } else if (axisFilter === "complex") {
      if (n === 0) baseLabel = "0";
      else if (n === 1) baseLabel = "i";
      else if (n === -1) baseLabel = "-i";
      else baseLabel = `${n}i`;
    } else if (axisFilter === "degrees") {
      baseLabel = `${n}°`;
    } else if (axisFilter === "radians") {
      baseLabel = `${n} rad`;
    } else if (axisFilter === "scientific") {
      if (n === 0) baseLabel = "0";
      else {
        const [m, eStr] = n.toExponential(axisDecimals).split("e");
        const exponent = eStr.replace("+", "");
        const supExp = toSuperscript(exponent);
        baseLabel = `${m} × 10${supExp}`;
      }
    } else if (axisFilter === "fractions") {
      if (n % 1 === 0) baseLabel = n.toString();
      else {
        const precision = 1000000;
        const numerator = Math.round(n * precision);
        const denominator = precision;
        const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
        const d = gcd(Math.abs(numerator), denominator);
        baseLabel = `${numerator / d}/${denominator / d}`;
      }
    } else {
      // "numeric"
      let effectiveDecimals = axisDecimals;
      if (adaptiveStep !== undefined && adaptiveStep > 0) {
        const stepLog = Math.log10(adaptiveStep);
        if (stepLog < 0) {
          const requiredDecimals = Math.ceil(Math.abs(stepLog));
          effectiveDecimals = Math.max(axisDecimals, requiredDecimals);
        }
      }
      
      const rounded = Number(n.toFixed(effectiveDecimals));
      baseLabel = axisThousandsSep ? rounded.toLocaleString() : rounded;
    }
    
    // Apply scientific notation for ALL formats if the number is extraordinarily large or small
    // (Desmos-like behavior) except when custom mapping or explicit scientific/fractions are chosen
    if (typeof baseLabel === "number" || (axisFilter === "all" || axisFilter === "numeric" || axisFilter === "even" || axisFilter === "odd")) {
       const absN = Math.abs(n);
       if (baseLabel !== "" && absN > 0 && (absN >= 1e6 || absN <= 1e-4)) {
         const str = absN.toExponential();
         const [coef, exp] = str.split('e');
         const cleanCoef = parseFloat(coef);
         const sign = n < 0 ? "-" : "";
         const supExp = toSuperscript(parseInt(exp, 10).toString());
         baseLabel = `${sign}${cleanCoef === 1 ? '' : cleanCoef + '×'}10${supExp}`;
       } else if (typeof baseLabel === "number") {
         // Keep floating point math from destroying readability
         baseLabel = parseFloat(baseLabel.toPrecision(12));
       }
    }

    if (baseLabel === "") return "";

    // React supports strings in Mafs labels if not using foreignObject
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
  axisStepStr: string;
  axisFilter: string;
  axisDecimals: number;
  axisThousandsSep: boolean;
  axisPrefix: string;
  axisSuffix: string;
  customAxisFilter: string;
  customAxisMapping: string;
}

export const AdaptiveGrid: React.FC<AdaptiveGridProps> = ({
  gridType,
  gridSubdivisions,
  parsedAxisStep,
  axisStepStr,
  axisFilter,
  axisDecimals,
  axisThousandsSep,
  axisPrefix,
  axisSuffix,
  customAxisFilter,
  customAxisMapping,
}) => {
  const pane = usePaneContext();
  const { viewTransform } = useTransformContext();
  
  const scaleX = viewTransform[0];
  const scaleY = viewTransform[4];

  let xStep = parsedAxisStep;
  let yStep = parsedAxisStep;

  // We want labels approximately 80 pixels apart (major grid lines)
  const targetMathSpacingX = 80 / scaleX;
  const targetMathSpacingY = 80 / Math.abs(scaleY);
  
  const niceStepX = getNiceStep(targetMathSpacingX);
  const niceStepY = getNiceStep(targetMathSpacingY);
  
  const userSpecifiedStep = axisStepStr.trim() !== "";
  const effectiveStepX = userSpecifiedStep ? parsedAxisStep : niceStepX;
  const effectiveStepY = userSpecifiedStep ? parsedAxisStep : niceStepY;
  
  // Grid lines rendered automatically with subdivisions of the major step
  xStep = effectiveStepX;
  yStep = effectiveStepY;

  const getAxisLabel = React.useMemo(() => createAxisLabelFormatter({
    axisFilter,
    axisDecimals,
    axisThousandsSep,
    axisPrefix,
    axisSuffix,
    customAxisFilter,
    customAxisMapping,
  }), [axisFilter, axisDecimals, axisThousandsSep, axisPrefix, axisSuffix, customAxisFilter, customAxisMapping]);

  let dynamicLabelsX: ((n: number) => React.ReactNode) | false = (n) => getAxisLabel(n, parsedAxisStep);
  let dynamicLabelsY: ((n: number) => React.ReactNode) | false = (n) => getAxisLabel(n, parsedAxisStep);

  dynamicLabelsX = (n: number) => {
    const isLabelStep = Math.abs((n / effectiveStepX) - Math.round(n / effectiveStepX)) < 1e-4;
    if (!isLabelStep) return "";
    return getAxisLabel(n, effectiveStepX);
  };

  dynamicLabelsY = (n: number) => {
    const isLabelStep = Math.abs((n / effectiveStepY) - Math.round(n / effectiveStepY)) < 1e-4;
    if (!isLabelStep) return "";
    return getAxisLabel(n, effectiveStepY);
  };

  if (gridType === "cartesian") {
    return (
      <Coordinates.Cartesian
        xAxis={{ lines: xStep, labels: dynamicLabelsX }}
        yAxis={{ lines: yStep, labels: dynamicLabelsY }}
        subdivisions={gridSubdivisions || 5}
      />
    );
  }
  
  if (gridType === "polar") {
    // We want labels approximately 80 pixels apart (major grid lines)
    const targetMathSpacing = 80 / scaleX;
    const niceStep = getNiceStep(targetMathSpacing);
    const effectiveStep = userSpecifiedStep ? parsedAxisStep : niceStep;

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
