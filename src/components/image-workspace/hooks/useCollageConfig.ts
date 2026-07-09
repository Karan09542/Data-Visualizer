import { useState } from "react";


export const useCollageConfig = () => {
const [collagePaddingPercent, setCollagePaddingPercent] = useState<number>(5);
  const [collageGapPercent, setCollageGapPercent] = useState<number>(2);
  const [collageBgColor, setCollageBgColor] = useState<string>('#333333');
  const [collageBorderColor, setCollageBorderColor] = useState<string>('#555555');
  const [collageBorderWidth, setCollageBorderWidth] = useState<number>(2);
  const [collageCornerRadius, setCollageCornerRadius] = useState<number>(8);
  const [useIndividualCorners, setUseIndividualCorners] = useState<boolean>(false);
  const [collageCornerTL, setCollageCornerTL] = useState<number>(8);
  const [collageCornerTR, setCollageCornerTR] = useState<number>(8);
  const [collageCornerBR, setCollageCornerBR] = useState<number>(8);
  const [collageCornerBL, setCollageCornerBL] = useState<number>(8);
  const [collageBorderStyle, setCollageBorderStyle] = useState<'solid' | 'dashed' | 'none'>('dashed');

  return {
    collagePaddingPercent, setCollagePaddingPercent,
    collageGapPercent, setCollageGapPercent,
    collageBgColor, setCollageBgColor,
    collageBorderColor, setCollageBorderColor,
    collageBorderWidth, setCollageBorderWidth,
    collageCornerRadius, setCollageCornerRadius,
    useIndividualCorners, setUseIndividualCorners,
    collageCornerTL, setCollageCornerTL,
    collageCornerTR, setCollageCornerTR,
    collageCornerBR, setCollageCornerBR,
    collageCornerBL, setCollageCornerBL,
    collageBorderStyle, setCollageBorderStyle
  };
};