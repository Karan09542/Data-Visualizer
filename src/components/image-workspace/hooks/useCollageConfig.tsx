import React, { createContext, useContext, useState, ReactNode } from "react";

const CollageConfigContext = createContext<any>(null);

export const CollageConfigProvider: React.FC<{
  value: any;
  children: ReactNode;
}> = ({ value, children }) => (
  <CollageConfigContext.Provider value={value}>
    {children}
  </CollageConfigContext.Provider>
);

export const useCollageConfigState = () => {
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

export const useCollageConfig = () => {
  const context = useContext(CollageConfigContext);
  if (!context) {
    throw new Error('useCollageConfig must be used within a CollageConfigProvider');
  }
  return context;
};