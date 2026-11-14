import {
  HelpCircle,
  LineChart,
  BookOpen,
  Binary,
  Variable,
  Play,
  Move,
  Layers,
  Compass,
  Waves,
  Hand,
  Sparkles,
  Info,
  Zap,
  Clock,
  Timer,
  MousePointer2,
  Grid3x3,
  Tag,
  Activity,
  Save,
  Settings2,
  Box,
  Download,
  Eye,
  Orbit,
  ScanLine,
  Video,
  Wind,
} from 'lucide-react';
import type { HelpContent } from './HelpDialog';
import { DihedralIcon, FootIcon, LinePlaneIcon, PlaneIcon, SkewLinesIcon } from '../math-node/spaceToolIcons';

/** What "Insert" adds to the graph: a row of this type with this expression */
export type MathRowType =
  | 'function'
  | 'parametric'
  | 'point'
  | 'implicit'
  | 'polar'
  | 'vector'
  | 'polygon'
  | 'inequality'
  | 'line'
  | 'differential';

export interface MathInsert {
  type: MathRowType;
  expr: string;
  expr2?: string;
  name?: string;
}

const insert = (type: MathRowType, expr: string): MathInsert => ({ type, expr });

/*
 * The Math Studio guide. Edit the words here; HelpDialog decides how it looks.
 * Examples with a payload get an "Insert" button when the guide is opened from a graph.
 */
export const mathHelp: HelpContent = {
  title: 'Math Studio guide',
  subtitle: 'Plot, animate and simulate with equations',
  icon: Sparkles,
  footerHint: { keys: ['F1'], label: 'or Alt+H in the graph editor opens this guide' },
  sections: [
    {
      id: 'getting-started',
      title: 'Getting started',
      icon: HelpCircle,
      tone: 'indigo',
      description:
        'A math node is a graphing canvas inside your workspace. Plot functions, curves, points, vectors and regions, and drive them with sliders and time.',
      blocks: [
        {
          type: 'cards',
          items: [
            {
              icon: Info,
              title: 'More than a calculator',
              text: 'It understands explicit, implicit, polar and parametric formulas and draws them as sharp vector plots.',
            },
            {
              icon: Zap,
              title: 'Updates as you type',
              text: 'Every formula, slider and setting is re-evaluated continuously, so the graph changes the moment you do.',
            },
          ],
        },
        {
          type: 'syntax',
          items: [
            { code: '1. Parse', label: 'MathJS turns what you type into an expression and flags syntax errors live' },
            { code: '2. Evaluate', label: 'One scope holds `x`, `y`, time `t` and every slider value' },
            { code: '3. Draw', label: 'Paths, regions, points and labels stay aligned as you zoom and pan' },
          ],
        },
      ],
    },
    {
      id: 'function-types',
      title: 'Row types',
      icon: LineChart,
      tone: 'blue',
      description: 'Each row has a type. Click the symbol at the left of a row to change it.',
      blocks: [
        {
          type: 'callout',
          title: 'Calculator rows (calc)',
          text: 'Pick `calc` as a row type (or Quick Inserts → Calculator) and the answer appears as you type. Arithmetic is exact to 64 digits, so `0.1 + 0.2` is 0.3 and `2^64` shows all 20 digits. Very large or small answers switch to ×10ⁿ; choose 123 for normal digits or ×10ⁿ for scientific notation, and how many significant digits to keep. Sliders, named values and units work: `5 km to mi`.',
        },
        {
          type: 'examples',
          items: [
            { title: 'Function · y = f(x)', text: 'A curve with one y for each x.', code: 'sin(x) * cos(t)', payload: insert('function', 'sin(x) * cos(t)') },
            { title: 'Family of curves · family(0:n, ...)', text: 'Plots a sequence of separate curves for each value of index i.', code: 'family(0:n, f(i) = sin(x) + i)', payload: insert('function', 'family(0:n, f(i) = sin(x) + i)') },
            { title: 'Implicit · f(x, y) = 0', text: 'Every point where the equation holds: circles, ellipses, hyperbolas.', code: 'x^2 + y^2 - 9', payload: insert('implicit', 'x^2 + y^2 - 9') },
            { title: 'Polar · r = f(θ)', text: 'Distance from the origin at each angle.', code: '2 * cos(4 * theta)', payload: insert('polar', '2 * cos(4 * theta)') },
            { title: 'Parametric · [x(t), y(t)]', text: 'x and y both follow `t`, from 0 to 2π.', code: '[3 * cos(t), 2 * sin(t)]', payload: insert('parametric', '[3 * cos(t), 2 * sin(t)]') },
            { title: 'Point · [x, y]', text: 'A single dot. It can follow sliders or be dragged.', code: '[2, 3]', payload: insert('point', '[2, 3]') },
            { title: 'Vector · [x, y]', text: 'An arrow from the origin (or a chosen start) to the point.', code: '[3, 2]', payload: insert('vector', '[3, 2]') },
          ],
        },
      ],
    },
    {
      id: 'latex',
      title: 'LaTeX notation',
      icon: BookOpen,
      tone: 'purple',
      description: 'Use LaTeX in labels and notes; it renders as typeset math. Insert adds the matching formula the graph understands.',
      blocks: [
        {
          type: 'examples',
          items: [
            { title: 'Power', code: 'x^2', preview: 'x^2', payload: insert('function', 'x^2') },
            { title: 'Longer exponent', code: 'x^{10}', preview: 'x^{10}', payload: insert('function', 'x^10') },
            { title: 'Fraction', code: '\\frac{a}{b}', preview: '\\frac{a}{b}', payload: insert('function', 'a/b') },
            { title: 'Square root', code: '\\sqrt{x}', preview: '\\sqrt{x}', payload: insert('function', 'sqrt(x)') },
            { title: 'Sum', code: '\\sum_{i=1}^{n} i^2', preview: '\\sum_{i=1}^{n} i^2', payload: insert('function', 'sum(map(1:n, f(i)=i^2))') },
            { title: 'Product', code: '\\prod_{i=1}^{n} i', preview: '\\prod_{i=1}^{n} i', payload: insert('function', 'prod(map(1:n, f(i)=i))') },
            { title: 'Definite integral', code: '\\int_a^b f(x)\\,dx', preview: '\\int_a^b f(x)\\,dx' },
            { title: 'Greek letters', code: '\\theta \\quad \\alpha \\quad \\pi', preview: '\\theta \\quad \\alpha \\quad \\pi' },
          ],
        },
      ],
    },
    {
      id: 'mathjs',
      title: 'Functions reference',
      icon: Binary,
      tone: 'amber',
      description: 'Formulas are evaluated with Math.js. These are the functions you will reach for most.',
      blocks: [
        {
          type: 'syntax',
          items: [
            { code: 'sin(x)  cos(x)  tan(x)', label: 'Trigonometry (radians)' },
            { code: 'abs(x)  sqrt(x)  sign(x)', label: 'Absolute value, roots, sign' },
            { code: 'log(x)  log10(x)  ln(x)', label: 'Logarithms' },
            { code: 'exp(x)  pow(x, y)  x^y', label: 'Exponents' },
          ],
        },
        {
          type: 'syntax',
          items: [
            { code: '[[1, 2], [3, 4]]', label: 'A matrix' },
            { code: 'det(M)', label: 'Determinant' },
            { code: 'dot(V1, V2)  norm(V1)', label: 'Dot product, length' },
            { code: 'map(1:5, f(i) = i^2)', label: 'Apply to each item' },
            { code: 'family(0:n, f(i) = sin(x) + i)', label: 'Family of curves (also sequence, seq, render)' },
            { code: 'filter([1,2,3,4], f(x) = x > 2)', label: 'Keep matching items' },
          ],
        },
        {
          type: 'syntax',
          items: [
            { code: 'max(map(1:10, f(i) = -i^2 + 5i))', label: 'Largest value of a series' },
            { code: 'min(...)  mean(...)  median(...)', label: 'Smallest, average, middle' },
            { code: 'std(map(1:10, f(i) = i^2))', label: 'Standard deviation' },
          ],
        },
        {
          type: 'examples',
          items: [
            {
              title: 'Collinearity with a determinant',
              text: 'As an implicit row, a 3×3 determinant equal to zero draws the line through two points.',
              code: 'det([[x, y, 1], [1, 1, 1], [2, 3, 1]])',
              payload: insert('implicit', 'det([[x, y, 1], [1, 1, 1], [2, 3, 1]])'),
            },
          ],
        },
      ],
    },
    {
      id: 'variables',
      title: 'Variables and sliders',
      icon: Variable,
      tone: 'emerald',
      description: 'You never declare sliders yourself: type an unknown letter and a slider appears.',
      blocks: [
        {
          type: 'syntax',
          items: [
            { code: 'x', label: 'Horizontal position' },
            { code: 'y', label: 'Vertical position' },
            { code: 't  or  time', label: 'The animation clock, in seconds' },
            { code: 'theta  or  θ', label: 'The angle in polar rows' },
            { code: 'z, u, v (3D)', label: 'Third axis (`z`) and surface parameters (`u`, `v` from 0 to 2π) — only special in 3D' },
          ],
        },
        {
          type: 'callout',
          title: 'Sliders appear on their own',
          text: 'Use a letter like `a`, `k` or `freq` in any formula and a slider (−10 to 10 by default) is added under your rows. Sliders can depend on each other: define `b = a * 2` and `b` follows `a` as you drag it.',
        },
      ],
    },
    {
      id: 'animation',
      title: 'Animation and timeline',
      icon: Play,
      tone: 'cyan',
      description: 'Use `t` (or `time`) in a formula and it moves when the timeline plays.',
      blocks: [
        {
          type: 'examples',
          items: [
            { title: 'Travelling wave', text: 'Subtracting `t` shifts the wave as time passes.', code: 'sin(x - t)', payload: insert('function', 'sin(x - t)') },
            { title: 'Moving point', text: 'A point going round the unit circle.', code: '[cos(t), sin(t)]', payload: insert('point', '[cos(t), sin(t)]') },
          ],
        },
        {
          type: 'cards',
          items: [
            {
              icon: Clock,
              title: 'Global timeline',
              text: 'The clock at the bottom of the graph. Every row uses it by default through `t` or `time`; play, speed (0.5× to 2×) and loop control it. Use it to keep several moving things in step.',
            },
            {
              icon: Timer,
              title: 'A row’s own timeline',
              text: 'Turn on Individual Timeline in a row’s settings to give it its own clock, speed and range. Inside that row `t` means its own clock. Other rows can read it as `t_1`, `t_2`… (by position) or `t_f` (by name).',
            },
          ],
        },
        {
          type: 'examples',
          items: [
            {
              title: 'Follow another row’s clock',
              text: 'If row 1 has its own timeline running 0 to 5, this point follows it while everything else follows the global clock.',
              code: '[t_1, sin(t_1)]',
              payload: insert('point', '[t_1, sin(t_1)]'),
            },
          ],
        },
      ],
    },
    {
      id: 'transformations',
      title: 'Moving and transforming',
      icon: Move,
      tone: 'indigo',
      blocks: [
        {
          type: 'cards',
          items: [
            {
              icon: MousePointer2,
              title: 'Drag on the graph',
              text: 'Turn on Draggable for a point or vector to get a handle on the canvas. Drag it and every row that depends on it updates.',
            },
            {
              icon: Grid3x3,
              title: 'Transform with formulas',
              text: 'Scale, stretch and shift curves in the formula itself, e.g. `y = 2 * sin(x * 1.5)` is taller and squeezed.',
            },
          ],
        },
      ],
    },
    {
      id: 'inequalities',
      title: 'Inequalities',
      icon: Layers,
      tone: 'rose',
      description: 'Use `<`, `<=`, `>` or `>=` to shade a region. `<=` and `>=` draw a solid edge; `<` and `>` a dashed one.',
      blocks: [
        {
          type: 'examples',
          items: [
            { title: 'Below a curve', text: 'Shades everything under the sine wave.', code: 'y <= sin(x)', payload: insert('inequality', 'y <= sin(x)') },
            { title: 'Inside a circle', text: 'The disc of radius 3 around the origin.', code: 'x^2 + y^2 <= 9', payload: insert('inequality', 'x^2 + y^2 <= 9') },
          ],
        },
      ],
    },
    {
      id: 'polar-parametric',
      title: 'Polar and parametric',
      icon: Compass,
      tone: 'purple',
      description: 'Spirals, roses, Lissajous figures and orbits.',
      blocks: [
        {
          type: 'examples',
          items: [
            {
              title: 'Polar rose',
              text: 'Give the radius `r` as a function of `theta` (or `θ`); it sweeps a full turn.',
              code: '3 * sin(5 * theta)',
              payload: insert('polar', '3 * sin(5 * theta)'),
            },
            {
              title: 'Parametric figure',
              text: 'Give `[x, y]` as functions of `t`, which runs from 0 to 2π.',
              code: '[cos(t*3), sin(t*2)]',
              payload: insert('parametric', '[cos(t*3), sin(t*2)]'),
            },
          ],
        },
      ],
    },
    {
      id: '3d-surfaces',
      title: '3D surfaces and curves',
      icon: Box,
      tone: 'cyan',
      description: 'Switch the graph to 3D to plot surfaces, implicit shapes, space curves and 3D points.',
      blocks: [
        {
          type: 'callout',
          title: 'z, u and v are only special in 3D',
          text: 'In 3D view, `z` is the third axis and `u`, `v` sweep from 0 to 2π across parametric surfaces without creating sliders. In 2D view, `z`, `u` and `v` have no special meaning and behave like ordinary variables.',
        },
        {
          type: 'examples',
          items: [
            {
              title: 'Parametric surface (torus)',
              text: 'A parametric surface (`u`, `v` from 0 to 2π). Note: `z`, `u`, `v` are only special in 3D.',
              code: '[(2+cos(v))*cos(u), (2+cos(v))*sin(u), sin(v)]',
              payload: insert('parametric', '[(2+cos(v))*cos(u), (2+cos(v))*sin(u), sin(v)]'),
            },
            {
              title: 'Explicit surface · z = f(x, y)',
              text: 'Equations mentioning `z` plot a 3D surface.',
              code: 'z = x^2 - y^2',
              payload: insert('function', 'z = x^2 - y^2'),
            },
            {
              title: 'Space curve · [x(t), y(t), z(t)]',
              text: 'Three coordinates driven by `t` trace a curve in space.',
              code: '[cos(t), sin(t), t/4]',
              payload: insert('parametric', '[cos(t), sin(t), t/4]'),
            },
            {
              title: 'Plane · ax + by + cz = d',
              text: 'A flat equation in `x`, `y` and `z` is drawn as an exact plane, cut to the box.',
              code: 'x + 2*y - z = 1',
              payload: insert('implicit', 'x + 2*y - z = 1'),
            },
            {
              title: 'Solid region · inequality in x, y, z',
              text: 'Fills the part of space where it holds: its boundary, plus shaded caps where it meets the walls of the box.',
              code: 'x^2 + y^2 + z^2 <= 9',
              payload: insert('inequality', 'x^2 + y^2 + z^2 <= 9'),
            },
            {
              title: 'Spherical · ρ = f(θ, φ)',
              text: 'Use `phi` (or `φ`) with `theta` in a polar row, or start it with `rho =`: `θ` goes round the z-axis, `φ` down from the top.',
              code: '2 + 0.5*sin(3*theta)*sin(phi)^2',
              payload: insert('polar', '2 + 0.5*sin(3*theta)*sin(phi)^2'),
            },
            {
              title: 'Cylindrical · r = f(θ, z)',
              text: 'A polar row that uses `z` wraps round the z-axis into a surface.',
              code: '1 + 0.3*cos(4*theta) + 0.1*z^2',
              payload: insert('polar', '1 + 0.3*cos(4*theta) + 0.1*z^2'),
            },
          ],
        },
        {
          type: 'callout',
          title: 'Where surfaces meet',
          text: 'When two surfaces cross, the curve where they meet is drawn in yellow, e.g. a plane cutting a sphere in a circle, or two planes meeting in a line. Turn it off with Intersections in the 3D options (the sliders button, bottom right).',
        },
      ],
    },
    {
      id: '3d-calculus',
      title: '3D fields and solids',
      icon: Wind,
      tone: 'emerald',
      description: 'Vector fields and solids of revolution, drawn in the 3D view.',
      blocks: [
        {
          type: 'syntax',
          items: [
            { code: 'field([P, Q, R])', label: 'A vector field: arrows coloured blue (weak) to red (strong), and lines that follow the flow. `field(P, Q, R)` works too.' },
            { code: 'revolve(f, a, b)', label: 'Spins y = f(x), from x = a to b, round the x-axis into a solid, and shows its volume π∫f² dx' },
            { code: 'revolve(f, a, b, "y")', label: 'Round the y-axis instead: the volume by shells, 2π∫x·f dx' },
            { code: 'volumeUnder(f, a, b, c, d, n)', label: 'The volume under z = f(x, y) over a ≤ x ≤ b, c ≤ y ≤ d: n × n boxes (a Riemann sum) and the double integral ∬f dA' },
            { code: 'divergence(F, P)  ·  curl(F, P)', label: 'For a field written as a function, F(x, y, z) = [P, Q, R]: how much it spreads out, and how it spins, at the point P' },
          ],
        },
        {
          type: 'examples',
          items: [
            {
              title: 'Swirling field',
              text: 'Spins round the z-axis and rises. Name it (`F = field(…)`) to use it in other rows.',
              code: 'F = field([-y, x, z/3])',
              payload: insert('function', 'F = field([-y, x, z/3])'),
            },
            {
              title: 'Riemann boxes under a surface',
              text: 'Try more boxes (the last number): the sum closes in on the double integral.',
              code: 'volumeUnder(3 - (x^2 + y^2)/4, -2, 2, -1.5, 1.5, 6)',
              payload: insert('function', 'volumeUnder(3 - (x^2 + y^2)/4, -2, 2, -1.5, 1.5, 6)'),
            },
            {
              title: 'Paraboloid by discs',
              text: 'y = √x spun round the x-axis, from 0 to 4: volume 8π.',
              code: 'revolve(sqrt(x), 0, 4)',
              payload: insert('function', 'revolve(sqrt(x), 0, 4)'),
            },
          ],
        },
        {
          type: 'callout',
          title: 'In the 2D view',
          text: '`revolve(…)` shows just its curve y = f(x). Rows that use `z`, such as fields and cylindrical surfaces, ask you to switch to 3D.',
        },
      ],
    },
    {
      id: '3d-tools',
      title: '3D tools, views and export',
      icon: Orbit,
      tone: 'blue',
      description: 'Drawing in space, a flat view for technical drawings, and taking your graph elsewhere.',
      blocks: [
        {
          type: 'cards',
          items: [
            {
              icon: MousePointer2,
              title: 'Select and transform',
              text: 'The Select tool works in 3D too: click a shape (Shift-click adds more), then drag the red, green and blue arrows to move it along x, y and z. Turn it about x, y or z with the red, green and yellow rings, or freely with the purple handle; the X, Y and Z switches in the bar pick which axes (one, two or all three). The green square resizes it, Delete removes it, and dragging empty space still turns the view.',
            },
            {
              icon: PlaneIcon,
              title: 'Plane through 3 points',
              text: 'In the drawing tools (3D only): click three points for the plane through them, with its equation, e.g. 4x − 5y + 16z = 18. Two planes show the line where they meet.',
            },
            {
              icon: FootIcon,
              title: 'Perpendicular foot',
              text: 'Click a point, then three points of a plane: marks the foot of the perpendicular and the shortest distance from the point to the plane.',
            },
            {
              icon: DihedralIcon,
              title: 'Angle between planes',
              text: 'Click the two ends of the edge two planes share, then one point on each plane: shows both faces and the angle between them.',
            },
            {
              icon: LinePlaneIcon,
              title: 'Line meets plane',
              text: 'Click two points for a line, then three for a plane: marks the point where they meet.',
            },
            {
              icon: SkewLinesIcon,
              title: 'Distance between lines',
              text: 'Click two points on each of two lines: the shortest segment between them (square to both) and its length. Works for skew lines that never meet.',
            },
            {
              icon: Eye,
              title: 'Orthographic view',
              text: 'In the 3D options, under Display: no perspective, so parallel lines stay parallel and far things don’t shrink, as in a technical drawing.',
            },
            {
              icon: Download,
              title: 'Export STL or GLB',
              text: 'In the 3D options, under Export. STL saves surfaces for 3D printing, with curves as thin tubes; GLB saves surfaces and curves in colour for 3D apps like Blender. Both are cut to the box.',
            },
            {
              icon: Video,
              title: 'Spin video',
              text: 'Records one slow turn round the graph, with its labels and notes, as an MP4 (or WebM) video. The camera goes back where it was afterwards.',
            },
            {
              icon: ScanLine,
              title: 'Detailed surfaces stay smooth to use',
              text: 'A complicated implicit surface such as a gyroid shows a coarse version at once and sharpens a moment later, without freezing the page.',
            },
          ],
        },
        {
          type: 'syntax',
          items: [
            { code: 'planeNormal(A, B, C)', label: 'The normal of the plane through A, B and C: AB × AC' },
            { code: 'footOnPlane(P, A, B, C)', label: 'The foot of the perpendicular from P to the plane ABC' },
            { code: 'planeAngle(A, B, C, D)', label: 'The angle in degrees between planes ABC and ABD, which share the edge AB' },
            { code: 'planeArc(A, B, C, D, s, r)', label: 'The point a fraction s of the way round that angle, r out from the middle of AB' },
            { code: 'linePlane(A, B, C, D, E)', label: 'Where the line AB meets the plane CDE' },
            { code: 'lineDistance(A, B, C, D)', label: 'The shortest distance between the lines AB and CD; nearestOnLines(A, B, C, D, k) gives the closest points' },
            { code: 'surfaceArea(f, a, b, c, d)', label: 'The area of z = f(x, y) over a rectangle, for f written as f(x, y) = …' },
            { code: 'planeEquation(A, B, C)', label: 'The plane as text in its simplest form, for labels: {{planeEquation(A, B, C)}}' },
          ],
        },
      ],
    },
    {
      id: 'differential',
      title: 'Differential equations',
      icon: Waves,
      tone: 'blue',
      description:
        'Some motion has no neat formula: a pendulum swinging wide, a ball slowed by air, a planet in orbit. You can still say how fast things change. Pick the `x′ =` row type, write that rule, and the solver draws the path.',
      blocks: [
        {
          type: 'code',
          title: 'Written as on paper; separate parts with ; or new lines',
          code: "x'' = -k*x - c*x'; x(0) = 1; x'(0) = 0",
        },
        {
          type: 'syntax',
          items: [
            { code: "x'   x''", label: 'Speed and acceleration of x; add as many primes as you need' },
            { code: 'x(0) = 1', label: 'Where it starts' },
            { code: "x'(0) = 0", label: 'How fast it starts; anything left out starts at 0' },
            { code: "x' = v; v' = -x", label: 'Several equations together are solved together' },
            { code: 'k  c  …', label: 'Any other letter becomes a slider' },
          ],
        },
        {
          type: 'cards',
          items: [
            { icon: Settings2, title: 'Plot', text: 'What goes on each axis. `t` against `x` shows motion over time; `x` against `x′` shows position against speed.' },
            { icon: Activity, title: 'Time range and steps', text: 'How long to simulate, and how finely. More steps is more accurate and more work.' },
          ],
        },
        {
          type: 'callout',
          text: 'Solved with Runge–Kutta (RK4), which steps forward and checks the slope four times per step: a very close approximation, not an exact formula. Turn on Show moving point to see a dot travel along the solution.',
        },
        {
          type: 'examples',
          items: [
            { title: 'Damped oscillator', text: 'A spring losing energy to friction. Plot t against x.', code: "x'' = -k*x - c*x'; x(0) = 1; x'(0) = 0", payload: insert('differential', "x'' = -k*x - c*x'; x(0) = 1; x'(0) = 0") },
            { title: 'Pendulum, no small-angle shortcut', text: 'Swings wide, where the usual formula breaks down. Try theta against theta′.', code: "theta'' = -(g/L)*sin(theta); theta(0) = 2.5; theta'(0) = 0", payload: insert('differential', "theta'' = -(g/L)*sin(theta); theta(0) = 2.5; theta'(0) = 0") },
            { title: 'Population growth', text: 'Fast growth that levels off as it runs out of room.', code: "N' = r*N*(1 - N/K); N(0) = 1", payload: insert('differential', "N' = r*N*(1 - N/K); N(0) = 1") },
            { title: 'Orbit', text: 'Gravity pulling toward the centre. Plot x against y.', code: "x'' = -mu*x/(x^2 + y^2)^1.5; y'' = -mu*y/(x^2 + y^2)^1.5; x(0) = 1; y'(0) = 1", payload: insert('differential', "x'' = -mu*x/(x^2 + y^2)^1.5; y'' = -mu*y/(x^2 + y^2)^1.5; x(0) = 1; y'(0) = 1") },
          ],
        },
      ],
    },
    {
      id: 'simulations',
      title: 'Build a simulation',
      icon: Hand,
      tone: 'emerald',
      description:
        'The labs under Library → Simulations (projectile, spring, pendulum, motion graphs) are ordinary rows. Open one to see how it works, or build your own from these pieces.',
      blocks: [
        {
          type: 'syntax',
          items: [
            { code: 'T = 2*v0*sin(angle*pi/180)/g', label: 'A named value: shown under the row, usable in later rows' },
            { code: 'pos(s) = x0 + v0*s + a*s^2/2', label: 'Your own helper function' },
          ],
        },
        {
          type: 'code',
          title: 'An arrow between two points, e.g. velocity on a moving ball',
          code: 'ball = [vx*time, vy*time - g*time^2/2]\nVector(ball, ball + [vx, vy - g*time]/4)',
        },
        {
          type: 'cards',
          items: [
            {
              icon: MousePointer2,
              title: 'Drag handles',
              text: 'In a point or vector row’s settings, pick sliders under Drag on the graph sets. Dragging the point (or arrow tip) then moves them: one slider slides it along its path, two move it freely. Handles stop at each slider’s limits.',
            },
            {
              icon: Tag,
              title: 'Live labels',
              text: 'Put a formula in double braces to show its value: `t = {{time}} s`. Add `:N` for N decimals, as in `{{v0:1}}`. Tick Plain text for sentences.',
            },
            {
              icon: Waves,
              title: 'Follow a solved equation',
              text: 'A differential row shares its current state with later rows: `x`, and `x′` as `dx`. So a mass can sit at `[4 + x, 5]` while `x\'\' = -(k/m)*x` is solved.',
            },
            {
              icon: Play,
              title: 'Run once',
              text: 'In Timeline settings choose Run once: play goes to the end and stops, play again starts over. The end can be a formula such as `T`. Dragging a handle pauses and rewinds.',
            },
            {
              icon: Save,
              title: 'Save it',
              text: 'Use the save icon beside Functions & Equations, or Library → My Saved Graphs. Rows, sliders, groups, timeline and view are kept. Load restores it, Add puts its rows into the open graph, Update saves over it.',
            },
          ],
        },
      ],
    },
    {
      id: 'gallery',
      title: 'Gallery',
      icon: Sparkles,
      tone: 'amber',
      description: 'Ready-made curves to try. Insert adds one to the graph you have open.',
      blocks: [
        {
          type: 'examples',
          items: [
            { title: 'Circle', text: 'A parametric circle of radius 3.', code: '[3*cos(t), 3*sin(t)]', payload: insert('parametric', '[3*cos(t), 3*sin(t)]') },
            { title: 'Heart', text: 'A polar heart.', code: '2 - 2*sin(theta) + sin(theta)*sqrt(abs(cos(theta))) / (sin(theta) + 1.4)', payload: insert('polar', '2 - 2*sin(theta) + sin(theta)*sqrt(abs(cos(theta))) / (sin(theta) + 1.4)') },
            { title: 'Rose with 8 petals', code: '3 * cos(4 * theta)', payload: insert('polar', '3 * cos(4 * theta)') },
            { title: 'Archimedean spiral', text: 'The radius grows steadily with the angle.', code: '0.2 * theta', payload: insert('polar', '0.2 * theta') },
            { title: 'Lissajous figure, 3:2', code: '[3*sin(3*t), 3*cos(2*t)]', payload: insert('parametric', '[3*sin(3*t), 3*cos(2*t)]') },
            { title: 'Butterfly curve', text: 'Temple Fay’s butterfly.', code: 'exp(cos(theta)) - 2*cos(4*theta) + sin(theta/12)^5', payload: insert('polar', 'exp(cos(theta)) - 2*cos(4*theta) + sin(theta/12)^5') },
            { title: 'Fourier square wave', text: 'Three terms of a square wave.', code: 'sin(x) + sin(3*x)/3 + sin(5*x)/5', payload: insert('function', 'sin(x) + sin(3*x)/3 + sin(5*x)/5') },
            { title: 'Standing wave', text: 'Two waves travelling opposite ways; press play.', code: 'sin(x - t) + sin(x + t)', payload: insert('function', 'sin(x - t) + sin(x + t)') },
            { title: 'Family of curves', text: 'Plots separate curves for each index i from 0 to n.', code: 'family(0:n, f(i) = sin(x) + i)', payload: insert('function', 'family(0:n, f(i) = sin(x) + i)') },
            { title: 'Family of parabolas', text: 'Parabolas shifted vertically from i = -3 to 3.', code: 'family(-3:3, x^2 + i)', payload: insert('function', 'family(-3:3, x^2 + i)') },
          ],
        },
      ],
    },
  ],
};

