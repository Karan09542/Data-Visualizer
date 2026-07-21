# AI Models Integration Guide

This document outlines the architecture, normalization, and processing requirements for the AI models integrated into the application. It serves as a reference for maintaining existing models and adding new ones.

## 1. Background Removal Models

### ORMBG (RMBG-1.4)
* **Purpose**: High-quality, precise background removal for professional editing.
* **Resolution**: `1024x1024` (Native). This high resolution is why the edges and fine details (like hair) are extremely sharp compared to lightweight models.
* **Format**: Dynamic (Determined by `inputShape`, usually NCHW or NHWC).
* **Normalization**: `[0, 1]` standard. 
  * Formula: `val / 255.0`
* **Output Tensor**: 1-Channel Mask (`1 x H x W x 1`).
* **Post-Processing**: 
  * Outputs raw logits (values often `> 2.0` or `< -2.0`).
  * **MUST** apply Sigmoid activation to squash logits to `[0, 1]` probabilities.
  * Followed by Min-Max scaling to ensure the mask fully utilizes the `[0, 1]` opacity range.

### SINet (Extreme Lightweight Portrait Segmentation)
* **Purpose**: Ultra-fast, real-time background removal (optimized for >100 FPS on mobile).
* **Resolution**: `324x324` (or `224x224`). Because the model operates at a lower resolution, upscaling the resulting mask back to the original image dimensions naturally results in slightly softer/blurrier edges compared to ORMBG.
* **Format**: NHWC (Channel Last). *Note: While many PyTorch models are NCHW, specific quantized `.tflite` exports for mobile (like ours) are often converted to NHWC.*
* **Normalization**: `[0, 1]` standard.
  * Formula: `val / 255.0`
* **Output Tensor**: 2-Channel Mask (`1 x H x W x 2`) or 1-Channel.
  * Channel 0 is typically the Background probability.
  * Channel 1 is typically the Foreground probability.
  * *Best Practice*: Use an intelligent center-vs-corner heuristic to dynamically determine which channel represents the foreground to avoid inverted masks.
* **Post-Processing**:
  * Outputs raw logits. **MUST** apply Sigmoid activation to prevent stray outlier pixels from destroying the mask during scaling.

---

## 2. Image Enhancement Models

### VDSR (Super Resolution)
* **Purpose**: Bicubic image upscaling and enhancement.
* **Resolution**: Dynamic (Supports various input shapes, commonly `256x256`).
* **Format**: NHWC (Channel Last).
* **Normalization**: `[0, 1]` standard.
  * Formula: `val / 255.0`
* **Channels**: Can process RGB directly (3 channels) or operate solely on the Luminance (Y) channel (1 channel) for faster processing, combining the high-res Y prediction with bicubic Cb/Cr channels during post-processing.
* **Pre-Processing**: 
  * Requires the input to be pre-scaled to the target dimension using **High-Quality Bicubic Interpolation** (`imageSmoothingQuality = 'high'`). The model predicts the high-frequency *residual* missing from the bicubic scale.

---

## 3. General Best Practices

### Pre-Processing
* **Image Smoothing**: When downscaling original images to feed into a model (e.g., `1024px` -> `324px` for SINet), always enable high-quality canvas smoothing (`ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';`). Default canvas downscaling uses nearest-neighbor algorithms that create jagged aliasing artifacts, which can completely destroy the feature extraction of noise-sensitive CNNs.
* **Letterboxing**: Always pad the image with black bars to match the model's expected aspect ratio rather than warping/stretching the image.

### Post-Processing
* **Sigmoid Activation**: If a model's output tensor contains values outside the `[0, 1]` range (e.g., `[-15.0, +15.0]`), it is outputting raw logits. You must apply `1 / (1 + Math.exp(-val))` before doing Min-Max scaling. Failure to do so means a single outlier noise pixel will squash the opacity of the entire mask.
* **Mask Upscaling**: When upscaling a low-resolution mask (like SINet's `324x324`) back to the original image dimensions, ensure high-quality smoothing is enabled on the rendering context to minimize pixelation on the edges.
