export type NormalizationType = 
  | 'zero_to_one'       // pixel / 255.0  --> [0.0, 1.0]
  | 'minus_one_to_one' // (pixel / 127.5) - 1.0 --> [-1.0, 1.0]
  | 'raw_255';         // pixel --> [0.0, 255.0]

export interface ModelConfig {
  id: string;
  name: string;
  
  // Tiling & Input Dimensions
  requiresTiling: boolean;
  tileSize?: {
    inputWidth: number;
    inputHeight: number;
    outputScaleFactor: number; // e.g. 4 for 128x128 -> 512x512
    overlap?: number; // Padding added to all sides for tiling overlap (e.g. 16)
  };

  // Pre-processing
  preprocessing: {
    normalization: NormalizationType;
    channels: 1 | 3 | 4; // Gray, RGB, RGBA
  };

  // Post-processing
  postprocessing: {
    outputNormalized: boolean; // Is output [0..1] or [0..255]?
    channelOrder: 'RGB' | 'BGR';
  };
}
