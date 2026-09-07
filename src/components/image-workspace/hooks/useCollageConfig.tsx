import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

const CollageConfigContext = createContext<any>(null);

export const CollageConfigProvider: React.FC<{
  value: any;
  children: ReactNode;
}> = ({ value, children }) => (
  <CollageConfigContext.Provider value={value}>
    {children}
  </CollageConfigContext.Provider>
);

/** Single source of truth for the builder's starting values and for "Reset to defaults". */
export const COLLAGE_DEFAULTS = {
  paddingPercent: 5,
  gapPercent: 2,
  bgColor: '#333333',
  borderColor: '#555555',
  borderWidth: 2,
  cornerRadius: 8,
  useIndividualCorners: false,
  cornerRadiusPerCorner: 8,
  borderStyle: 'dashed' as 'solid' | 'dashed' | 'none',
};

export const useCollageConfigState = () => {
  const [collagePaddingPercent, setCollagePaddingPercent] = useState<number>(COLLAGE_DEFAULTS.paddingPercent);
  const [collageGapPercent, setCollageGapPercent] = useState<number>(COLLAGE_DEFAULTS.gapPercent);
  const [collageBgColor, setCollageBgColor] = useState<string>(COLLAGE_DEFAULTS.bgColor);
  const [collageBorderColor, setCollageBorderColor] = useState<string>(COLLAGE_DEFAULTS.borderColor);
  const [collageBorderWidth, setCollageBorderWidth] = useState<number>(COLLAGE_DEFAULTS.borderWidth);
  const [collageCornerRadius, setCollageCornerRadius] = useState<number>(COLLAGE_DEFAULTS.cornerRadius);
  const [useIndividualCorners, setUseIndividualCorners] = useState<boolean>(COLLAGE_DEFAULTS.useIndividualCorners);
  const [collageCornerTL, setCollageCornerTL] = useState<number>(COLLAGE_DEFAULTS.cornerRadiusPerCorner);
  const [collageCornerTR, setCollageCornerTR] = useState<number>(COLLAGE_DEFAULTS.cornerRadiusPerCorner);
  const [collageCornerBR, setCollageCornerBR] = useState<number>(COLLAGE_DEFAULTS.cornerRadiusPerCorner);
  const [collageCornerBL, setCollageCornerBL] = useState<number>(COLLAGE_DEFAULTS.cornerRadiusPerCorner);
  const [collageBorderStyle, setCollageBorderStyle] = useState<'solid' | 'dashed' | 'none'>(COLLAGE_DEFAULTS.borderStyle);

  const resetCollageConfig = useCallback(() => {
    setCollagePaddingPercent(COLLAGE_DEFAULTS.paddingPercent);
    setCollageGapPercent(COLLAGE_DEFAULTS.gapPercent);
    setCollageBgColor(COLLAGE_DEFAULTS.bgColor);
    setCollageBorderColor(COLLAGE_DEFAULTS.borderColor);
    setCollageBorderWidth(COLLAGE_DEFAULTS.borderWidth);
    setCollageCornerRadius(COLLAGE_DEFAULTS.cornerRadius);
    setUseIndividualCorners(COLLAGE_DEFAULTS.useIndividualCorners);
    setCollageCornerTL(COLLAGE_DEFAULTS.cornerRadiusPerCorner);
    setCollageCornerTR(COLLAGE_DEFAULTS.cornerRadiusPerCorner);
    setCollageCornerBR(COLLAGE_DEFAULTS.cornerRadiusPerCorner);
    setCollageCornerBL(COLLAGE_DEFAULTS.cornerRadiusPerCorner);
    setCollageBorderStyle(COLLAGE_DEFAULTS.borderStyle);
  }, []);

  return {
    resetCollageConfig,
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