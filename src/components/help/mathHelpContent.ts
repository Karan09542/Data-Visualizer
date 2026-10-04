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
} from 'lucide-react';
import type { HelpContent } from './HelpDialog';

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
          ],
        },
      ],
    },
  ],
};

