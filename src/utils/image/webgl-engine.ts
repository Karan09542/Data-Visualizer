/**
 * WebGL-based Perspective Transformation Engine
 * 
 * Provides hardware-accelerated 4-point perspective warping for images.
 */

export interface Point {
  x: number;
  y: number;
}

export class WebGLPerspectiveEngine {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private texture: WebGLTexture;

  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    // Vertex shader
    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader for perspective mapping
    // We pass the 3x3 homography matrix (u_matrix) to map output pixels to input pixels
    const fsSource = `
      precision mediump float;
      uniform sampler2D u_image;
      uniform mat3 u_matrix;
      varying vec2 v_texCoord;

      void main() {
        vec3 p = u_matrix * vec3(v_texCoord, 1.0);
        vec2 uv = p.xy / p.z;
        
        if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        } else {
          gl_FragColor = texture2D(u_image, vec2(uv.x, uv.y));
        }
      }
    `;

    this.program = this.createProgram(vsSource, fsSource);
    this.positionBuffer = this.gl.createBuffer()!;
    this.texCoordBuffer = this.gl.createBuffer()!;
    this.texture = this.gl.createTexture()!;
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      throw new Error('Shader compile failed');
    }
    return shader;
  }

  private createProgram(vs: string, fs: string): WebGLProgram {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vs);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fs);
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error(this.gl.getProgramInfoLog(program));
      throw new Error('Program link failed');
    }
    return program;
  }

  /**
   * Calculates a 3x3 homography matrix mapping from destination quad to source quad.
   * Both coordinates must be normalized [0, 1].
   */
  private getHomographyMatrix(src: Point[], dst: Point[]): number[] {
    const a: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < 4; i++) {
      a.push([
        dst[i].x, dst[i].y, 1, 0, 0, 0,
        -dst[i].x * src[i].x, -dst[i].y * src[i].x
      ]);
      b.push(src[i].x);
      a.push([
        0, 0, 0, dst[i].x, dst[i].y, 1,
        -dst[i].x * src[i].y, -dst[i].y * src[i].y
      ]);
      b.push(src[i].y);
    }

    const h = this.solveLinearSystem(a, b);
    h.push(1); // h33
    return h;
  }

  private solveLinearSystem(a: number[][], b: number[]): number[] {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(a[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(a[k][i]) > maxEl) {
          maxEl = Math.abs(a[k][i]);
          maxRow = k;
        }
      }
      for (let k = i; k < n; k++) {
        const tmp = a[maxRow][k];
        a[maxRow][k] = a[i][k];
        a[i][k] = tmp;
      }
      const tmp2 = b[maxRow];
      b[maxRow] = b[i];
      b[i] = tmp2;

      for (let k = i + 1; k < n; k++) {
        const c = -a[k][i] / a[i][i];
        for (let j = i; j < n; j++) {
          if (i === j) a[k][j] = 0;
          else a[k][j] += c * a[i][j];
        }
        b[k] += c * b[i];
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = b[i] / a[i][i];
      for (let k = i - 1; k >= 0; k--) {
        b[k] -= a[k][i] * x[i];
      }
    }
    return x;
  }

  /**
   * Warps an image using a perspective transformation.
   * `srcCorners` should be points in the original image (unnormalized coordinates).
   * Result is a canvas containing the cropped, flattened rectangle.
   */
  public warp(
    image: HTMLImageElement | HTMLCanvasElement, 
    srcCorners: Point[], 
    outWidth: number, 
    outHeight: number
  ): HTMLCanvasElement {
    this.canvas.width = outWidth;
    this.canvas.height = outHeight;
    this.gl.viewport(0, 0, outWidth, outHeight);

    // Normalize source points relative to image size
    // Note: WebGL texture Y axis is inverted (bottom to top), but we'll handle that in shader
    const normSrc = srcCorners.map(p => ({
      x: p.x / image.width,
      y: p.y / image.height
    }));

    // Destination is the full output canvas
    const normDst = [
      { x: 0, y: 1 }, // Top-left (shader space Y is inverted)
      { x: 1, y: 1 }, // Top-right
      { x: 1, y: 0 }, // Bottom-right
      { x: 0, y: 0 }  // Bottom-left
    ];

    // Compute matrix mapping from screen (dst) to texture (src)
    const h = this.getHomographyMatrix(normSrc, normDst);
    
    // WebGL matrices are column-major!
    const glMatrix = new Float32Array([
      h[0], h[3], h[6],
      h[1], h[4], h[7],
      h[2], h[5], h[8]
    ]);

    this.gl.useProgram(this.program);

    // Setup geometry (full screen quad)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]), this.gl.STATIC_DRAW);

    const positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Setup UVs (0 to 1)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      0.0, 1.0,
      1.0, 0.0,
      1.0, 1.0,
    ]), this.gl.STATIC_DRAW);

    const texCoordLocation = this.gl.getAttribLocation(this.program, "a_texCoord");
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Setup texture
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);

    // Set uniforms
    const matrixLocation = this.gl.getUniformLocation(this.program, "u_matrix");
    this.gl.uniformMatrix3fv(matrixLocation, false, glMatrix);

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Ensure rendering is finished before returning canvas
    this.gl.finish();

    return this.canvas;
  }
}
