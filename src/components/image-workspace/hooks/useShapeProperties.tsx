import React, { createContext, useContext, useState, ReactNode } from "react";

const ShapePropertiesContext = createContext<any>(null);

export const ShapePropertiesProvider: React.FC<{
  value: any;
  children: ReactNode;
}> = ({ value, children }) => (
  <ShapePropertiesContext.Provider value={value}>
    {children}
  </ShapePropertiesContext.Provider>
);

export const useShapePropertiesState = () => {
  const [shapeFillColor, setShapeFillColor] = useState<string>('transparent');
  const [shapeStrokeColor, setShapeStrokeColor] = useState<string>('#000000');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2);
  const [shapeBorderStyle, setShapeBorderStyle] = useState<'solid' | 'dashed' | 'none'>('solid');
  const [shapeCornerRadius, setShapeCornerRadius] = useState<number>(0);
  const [shapeUseIndividualCorners, setShapeUseIndividualCorners] = useState<boolean>(false);
  const [shapeCornerTL, setShapeCornerTL] = useState<number>(0);
  const [shapeCornerTR, setShapeCornerTR] = useState<number>(0);
  const [shapeCornerBL, setShapeCornerBL] = useState<number>(0);
  const [shapeCornerBR, setShapeCornerBR] = useState<number>(0);
  const [shapeOpacity, setShapeOpacity] = useState<number>(100);
  const [shapeStrokeLineJoin, setShapeStrokeLineJoin] = useState<'miter' | 'round' | 'bevel'>('miter');
  const [shapeStrokeLineCap, setShapeStrokeLineCap] = useState<'butt' | 'round' | 'square'>('butt');

  return {
    shapeFillColor, setShapeFillColor,
    shapeStrokeColor, setShapeStrokeColor,
    shapeStrokeWidth, setShapeStrokeWidth,
    shapeBorderStyle, setShapeBorderStyle,
    shapeCornerRadius, setShapeCornerRadius,
    shapeUseIndividualCorners, setShapeUseIndividualCorners,
    shapeCornerTL, setShapeCornerTL,
    shapeCornerTR, setShapeCornerTR,
    shapeCornerBL, setShapeCornerBL,
    shapeCornerBR, setShapeCornerBR,
    shapeOpacity, setShapeOpacity,
    shapeStrokeLineJoin, setShapeStrokeLineJoin,
    shapeStrokeLineCap, setShapeStrokeLineCap
  };
};

export const useShapeProperties = () => {
  const context = useContext(ShapePropertiesContext);
  if (!context) {
    throw new Error('useShapeProperties must be used within a ShapePropertiesProvider');
  }
  return context;
};