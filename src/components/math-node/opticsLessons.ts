/**
 * Ray optics lessons, built with the geometry lesson kit: reflection in a plane
 * mirror, refraction (Snell's law, total internal reflection, a glass slab, a
 * prism) and ray diagrams for lenses and curved mirrors.
 *
 * Lenses and mirrors use the Cartesian sign convention: distances are measured
 * from the lens or mirror, positive to the right, so the object's u is negative.
 */
import { TEXT, sceneGroup, sceneSlider, type SimulationScene } from "./simulations";
import {
  ANGLES,
  AMBER,
  BLUE,
  GREEN,
  PINK,
  RED,
  SKY,
  VIOLET,
  accent,
  lessonRows,
  scene,
  stack,
  type GeometryLesson,
} from "./geometryLessons";

const OPTICS_ACCENT = accent("bg-cyan-500", "ring-cyan-400/60 border-cyan-400", "text-cyan-600 dark:text-cyan-400");

const dashed = { lineStyle: "dashed" as const, outlineWidth: 1.5 };
const dotted = { lineStyle: "dotted" as const, outlineWidth: 1 };
const ray = { outlineWidth: 2 };
const opticsView = { x: [-13, 13] as [number, number], y: [-8, 5.5] as [number, number] };

// ─── Reflection ───────────────────────────────────────────────────────────────

function planeMirror(): SimulationScene {
  const r = lessonRows("gop_plane");
  return scene(
    [
      r.helpers(...ANGLES, "meet"),
      r.seg("[0, -4]", "[0, 4]", SKY, { outlineWidth: 5 }),
      r.text("[-0.6, 4.3]", "Mirror", SKY),
      r.free("P", [3, 1.5], BLUE),
      r.free("E", [4.5, -2], GREEN),
      r.text("E + [0.9, 0]", "eye", GREEN),
      r.point("P2 = [-P[1], P[2]]", PINK, "P′"),
      r.point("M = meet(E, P2, [0, 0], [0, 1])", AMBER),
      r.define("N = M + [1, 0]"),
      r.seg("M", "M + [2.5, 0]", TEXT, dashed),
      r.arrow("Vector(P, M)", AMBER, ray),
      r.arrow("Vector(M, E)", AMBER, ray),
      r.seg("M", "P2", AMBER, dashed),
      r.seg("P", "P2", TEXT, dotted),
      r.angle("M", "N", "P", AMBER, 0.8),
      r.angle("M", "N", "E", GREEN, 0.8),
      stack(r, 0, -4.8, [
        "Angle of incidence i = {{ang(M, N, P):1}}° = angle of reflection r = {{ang(M, N, E):1}}°",
        "P is {{P[1]}} in front of the mirror; its image P′ is {{-P2[1]}} behind it",
        "The image is virtual: the light only seems to come from P′",
      ]),
    ],
    [],
    [],
    { x: [-7, 7], y: [-6.8, 5] },
  );
}

// ─── Refraction ───────────────────────────────────────────────────────────────

function snellsLaw(): SimulationScene {
  const r = lessonRows("gop_snell");
  const status =
    '{{tir ? "Total internal reflection: all the light reflects back" : (n2 > n1 ? "Into a denser medium: it bends towards the normal" : (n2 < n1 ? "Into a less dense medium: it bends away from the normal" : "The same medium: it goes straight on"))}}';
  return scene(
    [
      r.helpers(...ANGLES),
      r.polygon("[[-12, 0], [12, 0], [12, -9], [-12, -9]]", SKY, { fillOpacity: 0.12, outlineWidth: 0, showAngles: false }),
      r.path("[t, 0]", SKY, [-12, 12], { outlineWidth: 2 }),
      r.seg("[0, 4.5]", "[0, -4.5]", TEXT, dashed),
      r.text("[0.9, 4.4]", "normal", TEXT),
      r.define("ii = inc*pi/180"),
      r.define("sinr = n1*sin(ii)/n2"),
      r.define("tir = sinr > 1"),
      r.define("rr = asin(min(1, sinr))"),
      r.handle("S = 4*[-sin(ii), cos(ii)]", AMBER, "", ["inc"]),
      r.define("Rf = 4*[sin(rr), -cos(rr)]"),
      r.arrow("Vector(S, [0, 0])", AMBER, ray),
      r.path("tir ? [NaN, NaN] : t*Rf", AMBER, [0, 1], { outlineWidth: 3 }),
      // Some light always reflects; all of it beyond the critical angle.
      r.path("t*4*[sin(ii), cos(ii)]", AMBER, [0, 1], { outlineWidth: 1, lineStyle: "dashed" }),
      r.path("t*(tir ? 4 : 0)*[sin(ii), cos(ii)]", AMBER, [0, 1], { outlineWidth: 3 }),
      r.angle("[0, 0]", "[0, 1]", "S", AMBER, 0.9),
      r.angle("[0, 0]", "[0, -1]", "Rf", GREEN, 0.9),
      r.text("[-7.5, 3.6]", "Medium 1: n₁ = {{n1}}", TEXT),
      r.text("[-7.5, -1.2]", "Medium 2: n₂ = {{n2}}", SKY),
      stack(r, 0, -5, [
        'Snell: n₁ sin i = {{n1*sin(ii):3}}   n₂ sin r = {{tir ? "—" : n2*sin(rr):3}}',
        'i = {{inc:1}}°   r = {{tir ? "none" : rr*180/pi:1}}°',
        status,
        'Critical angle c = sin⁻¹(n₂ ÷ n₁) = {{n1 > n2 ? asin(n2/n1)*180/pi : "none (only from denser to less dense)":1}}',
      ]),
    ],
    [
      sceneSlider("inc", "Angle of incidence i (°)", 40, [0, 89.9, 0.1], "Drag the start of the ray.", "light"),
      sceneSlider("n1", "n₁ (top)", 1, [1, 2.5, 0.01], "Air 1.00, water 1.33, glass 1.5, diamond 2.42.", "media"),
      sceneSlider("n2", "n₂ (bottom)", 1.5, [1, 2.5, 0.01], "Air 1.00, water 1.33, glass 1.5, diamond 2.42.", "media"),
    ],
    [sceneGroup("light", "Light ray"), sceneGroup("media", "Media (refractive index)")],
    { x: [-10, 10], y: [-8, 5] },
  );
}

function glassSlab(): SimulationScene {
  const r = lessonRows("gop_slab");
  return scene(
    [
      r.helpers(...ANGLES, "foot"),
      r.polygon("[[-12, 0], [12, 0], [12, -T], [-12, -T]]", SKY, { fillOpacity: 0.15, outlineWidth: 2, showAngles: false }),
      r.define("ii = inc*pi/180"),
      r.define("rr = asin(sin(ii)/ng)"),
      r.define("din = [sin(ii), -cos(ii)]"),
      r.define("Q = [T*tan(rr), -T]"),
      r.define("Fo = foot(Q, [0, 0], din)"),
      r.define("shift = T*sin(ii - rr)/cos(rr)"),
      r.seg("[0, 3]", "[0, -T - 1]", TEXT, dotted),
      r.seg("Q + [0, 1.2]", "Q - [0, 2.5]", TEXT, dotted),
      r.handle("S = -4*din", AMBER, "", ["inc"]),
      r.arrow("Vector(S, [0, 0])", AMBER, ray),
      r.seg("[0, 0]", "Q", AMBER, ray),
      r.arrow("Vector(Q, Q + 4*din)", AMBER, ray),
      r.seg("[0, 0]", "(T/cos(ii) + 4)*din", TEXT, dashed),
      r.seg("Q", "Fo", PINK, { outlineWidth: 3 }),
      r.text("(Q + Fo)/2 + 0.45*nrm(Q - Fo)", "d", PINK),
      r.angle("[0, 0]", "[0, 1]", "S", AMBER, 0.9),
      r.angle("[0, 0]", "[0, -1]", "Q", GREEN, 0.9),
      r.angle("Q", "Q - [0, 1]", "Q + din", AMBER, 0.9),
      r.text("[-7, -T/2]", "glass, n = {{ng}}", SKY),
      stack(r, 0, -7, [
        "Going in: sin i = n sin r, so r = {{rr*180/pi:1}}°",
        "Coming out: n sin r = sin e, so e = {{ang(Q, Q - [0, 1], Q + din):1}}° = i: it leaves parallel to how it came in",
        "Sideways shift d = t sin(i − r) ÷ cos r = {{shift}}",
      ]),
    ],
    [
      sceneSlider("inc", "Angle of incidence i (°)", 45, [0, 80, 0.5], "Drag the start of the ray.", "light"),
      sceneSlider("ng", "Refractive index n", 1.5, [1, 2.5, 0.01], "Glass is about 1.5.", "slab"),
      sceneSlider("T", "Thickness t", 2.5, [0.5, 4, 0.1], "How thick the slab is.", "slab"),
    ],
    [sceneGroup("light", "Light ray"), sceneGroup("slab", "Glass slab")],
    { x: [-10, 10], y: [-9.5, 4.5] },
  );
}

function prism(): SimulationScene {
  const r = lessonRows("gop_prism");
  // The ray for refractive index nn: in through the left face at H, out through the right face.
  return scene(
    [
      r.helpers(...ANGLES, "meet"),
      r.define("al = A*pi/360"),
      r.define("V = [0, 2.8]"),
      r.define("dL = [-sin(al), -cos(al)]"),
      r.define("dR = [sin(al), -cos(al)]"),
      r.define("sL = 5.6/cos(al)"),
      r.define("nL = [-cos(al), sin(al)]"),
      r.define("nR = [cos(al), sin(al)]"),
      r.define("H = V + 0.5*sL*dL"),
      r.define("ii = inc*pi/180"),
      r.define("din = cos(ii)*(-nL) + sin(ii)*(-dL)"),
      r.define("in1(nn) = cos(asin(sin(ii)/nn))*(-nL) + sin(asin(sin(ii)/nn))*(-dL)"),
      r.define("hit(nn) = meet(H, H + in1(nn), V, V + dR)"),
      // Along the face, n sin r = sin e; across it, whatever is left.
      r.define("tg(nn) = in1(nn) - dot(in1(nn), nR)*nR"),
      r.define("se(nn) = nn*norm(tg(nn))"),
      r.define("out(nn) = se(nn) > 1 ? [NaN, NaN] : sqrt(1 - se(nn)^2)*nR + nn*tg(nn)"),
      r.define("E = hit(ng)"),
      r.define("r1 = asin(sin(ii)/ng)*180/pi"),
      r.define("r2 = asin(norm(tg(ng)))*180/pi"),
      r.define("e = asin(min(1, se(ng)))*180/pi"),
      r.define("delta = acos(max(-1, min(1, dot(din, out(ng)))))*180/pi"),
      r.define("X = meet(H, H + din, E, E + out(ng))"),
      r.polygon("[V, V + sL*dL, V + sL*dR]", SKY, { fillOpacity: 0.15, showAngles: false }),
      r.text("V + [0, 0.45]", "A = {{A}}°", SKY),
      r.seg("H - 1.6*nL", "H + 1.6*nL", TEXT, dotted),
      r.seg("E - 1.6*nR", "E + 1.6*nR", TEXT, dotted),
      r.handle("S = H - 5*din", TEXT, "", ["inc"]),
      r.arrow("Vector(S, H)", TEXT, ray),
      r.text("S - [0, 0.5]", "white light", TEXT),
      r.seg("H", "hit(ng - 0.03)", RED, { outlineWidth: 1.5 }),
      r.seg("H", "E", GREEN, { outlineWidth: 1.5 }),
      r.seg("H", "hit(ng + 0.03)", VIOLET, { outlineWidth: 1.5 }),
      r.path("hit(ng - 0.03) + t*out(ng - 0.03)", RED, [0, 7], ray),
      r.path("E + t*out(ng)", GREEN, [0, 7], ray),
      r.path("hit(ng + 0.03) + t*out(ng + 0.03)", VIOLET, [0, 7], ray),
      r.seg("H", "X + 2*din", TEXT, dashed),
      r.angle("X", "X + din", "X + out(ng)", PINK, 0.9),
      stack(r, 0, -4.2, [
        "Deviation δ = {{delta:1}}° = i + e − A = {{inc:1}}° + {{e:1}}° − {{A}}°",
        "Inside the prism: r₁ + r₂ = {{r1:1}}° + {{r2:1}}° = A",
        "Violet (n bigger) bends most, red least: white light spreads into a spectrum",
      ]),
    ],
    [
      sceneSlider("inc", "Angle of incidence i (°)", 40, [20, 85, 0.5], "Drag the start of the ray.", "light"),
      sceneSlider("A", "Prism angle A (°)", 60, [30, 75, 1], "The angle at the top.", "prism"),
      sceneSlider("ng", "Refractive index n", 1.5, [1.3, 2, 0.01], "For green light; red a little less, violet a little more.", "prism"),
    ],
    [sceneGroup("light", "Light ray"), sceneGroup("prism", "Prism")],
    { x: [-10, 10], y: [-6.8, 5] },
  );
}

// ─── Lenses and mirrors ───────────────────────────────────────────────────────

const nature = (real: string, m: string) =>
  `{{${real} ? "Real and inverted" : "Virtual and upright"}}, {{abs(abs(${m}) - 1) < 0.01 ? "the same size" : (abs(${m}) > 1 ? "magnified" : "diminished")}}`;

/** A thin lens at x = 0: converging (f > 0) or diverging (f < 0). */
function thinLens(prefix: string, converging: boolean): SimulationScene {
  const r = lessonRows(prefix);
  return scene(
    [
      r.helpers("len", "nrm", "cross2"),
      r.define(converging ? "f = fl" : "f = -fl"),
      r.define("v = u*f/(u + f)"),
      r.define("hi = h*v/u"),
      r.path("[t, 0]", TEXT, [-30, 30], dotted),
      converging
        ? r.fill("[0.25*cos(t), 3.8*sin(t)]", SKY, [0, 2 * Math.PI], 0.25)
        : r.polygon("[[-0.4, 3.8], [0.4, 3.8], [0.12, 0], [0.4, -3.8], [-0.4, -3.8], [-0.12, 0]]", SKY, { fillOpacity: 0.25, outlineWidth: 1.5, showAngles: false }),
      r.handle("[fl, 0]", AMBER, "F", ["fl"]),
      r.point("[-fl, 0]", AMBER, "F"),
      r.point("[2*fl, 0]", TEXT, "2F"),
      r.point("[-2*fl, 0]", TEXT, "2F"),
      r.point("[0, 0]", TEXT, "O"),
      r.handle("Ob = [u, h]", BLUE, "", ["u", "h"]),
      r.define("Im = [v, hi]"),
      r.arrow("Vector([u, 0], Ob)", BLUE, { outlineWidth: 3.5 }),
      r.arrow("Vector([v, 0], Im)", PINK, { outlineWidth: 3.5 }),
      r.text("[u, h + (h >= 0 ? 0.45 : -0.45)]", "object", BLUE),
      r.text("[v, hi + (hi >= 0 ? 0.45 : -0.45)]", "image", PINK),
      // 1. In parallel to the axis, out through (or away from) a focus.
      r.seg("Ob", "[0, h]", RED, ray),
      r.path("[0, h] + t*nrm([1, -h/f])", RED, [0, 30], ray),
      r.seg("[0, h]", "v < 0 ? Im : [0, h]", RED, dashed),
      // 2. Through the centre, straight on.
      r.path("Ob + t*nrm(-Ob)", GREEN, [0, 30], ray),
      r.seg("Ob", "v < 0 ? Im : Ob", GREEN, dashed),
      // 3. Through (or towards) the other focus, out parallel.
      r.seg("Ob", "[0, hi]", VIOLET, ray),
      r.path("[0, hi] + t*[1, 0]", VIOLET, [0, 30], ray),
      r.seg("[0, hi]", "v < 0 ? Im : [0, hi]", VIOLET, dashed),
      stack(r, 0, -4.6, [
        "u = {{u}}   v = {{v}}   f = {{f}}   (from the lens: left is negative)",
        "Lens formula: 1/v − 1/u = {{1/v - 1/u:4}} = 1/f = {{1/f:4}}",
        `Magnification m = h′/h = v/u = {{v/u}}: ${nature("v > 0", "v/u")}`,
      ]),
    ],
    [
      sceneSlider("u", "Object distance u", converging ? -7.5 : -7, [-12, -0.5, 0.1], "Drag the object's tip.", "object"),
      sceneSlider("h", "Object height h", 2, [0.5, 3, 0.1], "Drag the object's tip.", "object"),
      sceneSlider("fl", "Focal length |f|", 3, [1, 6, 0.1], "Drag the focus F on the right.", "lens"),
    ],
    [sceneGroup("object", "Object"), sceneGroup("lens", "Lens")],
    opticsView,
  );
}

/** A curved mirror at x = 0, facing left: concave (f < 0) or convex (f > 0). */
function curvedMirror(prefix: string, concave: boolean): SimulationScene {
  const r = lessonRows(prefix);
  return scene(
    [
      r.helpers("len", "nrm", "cross2"),
      r.define(concave ? "f = -fl" : "f = fl"),
      r.define("v = u*f/(u - f)"),
      r.define("hi = -h*v/u"),
      r.define("sp = asin(min(0.9, 3.8/(2*fl)))"),
      r.path("[t, 0]", TEXT, [-30, 30], dotted),
      r.path("[2*f, 0] + 2*fl*[-sign(f)*cos(t*sp), sin(t*sp)]", SKY, [-1, 1], { outlineWidth: 5 }),
      r.handle("[f, 0]", AMBER, "F", ["fl"]),
      r.point("[2*f, 0]", TEXT, "C"),
      r.point("[0, 0]", TEXT, "P (pole)"),
      r.handle("Ob = [u, h]", BLUE, "", ["u", "h"]),
      r.define("Im = [v, hi]"),
      r.arrow("Vector([u, 0], Ob)", BLUE, { outlineWidth: 3.5 }),
      r.arrow("Vector([v, 0], Im)", PINK, { outlineWidth: 3.5 }),
      r.text("[u, h + (h >= 0 ? 0.45 : -0.45)]", "object", BLUE),
      r.text("[v, hi + (hi >= 0 ? 0.45 : -0.45)]", "image", PINK),
      // 1. In parallel to the axis, back through (or away from) the focus.
      r.seg("Ob", "[0, h]", RED, ray),
      r.path("[0, h] + t*nrm([-1, h/f])", RED, [0, 30], ray),
      r.seg("[0, h]", "v > 0 ? Im : [0, h]", RED, dashed),
      // 2. To the pole, back at the same angle.
      r.seg("Ob", "[0, 0]", GREEN, ray),
      r.path("t*nrm([u, -h])", GREEN, [0, 30], ray),
      r.seg("[0, 0]", "v > 0 ? Im : [0, 0]", GREEN, dashed),
      // 3. Through (or towards) the focus, back parallel.
      r.seg("Ob", "[0, hi]", VIOLET, ray),
      r.path("[0, hi] - t*[1, 0]", VIOLET, [0, 30], ray),
      r.seg("[0, hi]", "v > 0 ? Im : [0, hi]", VIOLET, dashed),
      stack(r, 0, -4.6, [
        "u = {{u}}   v = {{v}}   f = {{f}}   (from the pole: left is negative)",
        "Mirror formula: 1/v + 1/u = {{1/v + 1/u:4}} = 1/f = {{1/f:4}}   (R = 2f)",
        `Magnification m = −v/u = {{-v/u}}: ${nature("v < 0", "v/u")}`,
      ]),
    ],
    [
      sceneSlider("u", "Object distance u", concave ? -9 : -7, [-12, -0.5, 0.1], "Drag the object's tip.", "object"),
      sceneSlider("h", "Object height h", 2, [0.5, 3, 0.1], "Drag the object's tip.", "object"),
      sceneSlider("fl", "Focal length |f|", 3, [1.5, 6, 0.1], "Drag the focus F.", "mirror"),
    ],
    [sceneGroup("object", "Object"), sceneGroup("mirror", "Mirror")],
    opticsView,
  );
}

// ─── The lessons ──────────────────────────────────────────────────────────────

export const OPTICS_LESSONS: GeometryLesson[] = [
  {
    key: "geo_optics_plane",
    category: "Optics",
    title: "Plane Mirror",
    topic: "Reflection",
    summary: "The angle of incidence equals the angle of reflection; the image is as far behind as the object is in front.",
    facts: [
      "Laws of reflection: the angle of incidence equals the angle of reflection, both measured from the normal.",
      "The incident ray, the reflected ray and the normal lie in one plane.",
      "A plane mirror's image is virtual, upright, the same size, as far behind the mirror as the object is in front, and laterally inverted (left and right swap).",
    ],
    tryThis: ["Move the eye E: the light finds the one path that reaches it.", "Move P: the image P′ moves with it, mirrored."],
    challenges: [
      { text: "Make the angle of incidence 30°", check: "abs(ang(M, N, P) - 30) < 0.5" },
      { text: "Make the light come straight back (i = 0°)", check: "ang(M, N, P) < 0.5" },
    ],
    proof: [
      "Reflect P in the mirror to get P′. Any path P → mirror → E is as long as P′ → mirror → E.",
      "The shortest of those is the straight line from P′ to E: that's the path the light takes (Fermat's principle).",
      "The straight line makes equal angles with the mirror on each side, so i = r.",
    ],
    accent: OPTICS_ACCENT,
    build: planeMirror,
  },
  {
    key: "geo_optics_snell",
    category: "Optics",
    title: "Refraction & Snell's Law",
    topic: "Refraction",
    summary: "n₁ sin i = n₂ sin r, and total internal reflection beyond the critical angle.",
    facts: [
      "Light bends when it crosses into a medium of different refractive index n (n = speed of light in vacuum ÷ speed in the medium).",
      "Snell's law: n₁ sin i = n₂ sin r.",
      "Into a denser medium it bends towards the normal; into a less dense one, away from it.",
      "Going from denser to less dense, beyond the critical angle c = sin⁻¹(n₂/n₁) no light gets out: total internal reflection (optical fibres, diamonds' sparkle).",
    ],
    tryThis: ["Drag the ray and watch r change.", "Swap the media (n₁ = 1.5, n₂ = 1) and turn i past the critical angle."],
    challenges: [
      { text: "Send the ray straight through without bending (two ways)", check: "not tir and abs(rr - ii) < 0.002" },
      {
        text: "Glass to air (n₁ = 1.5, n₂ = 1): find the critical angle, where the ray skims the surface",
        check: "abs(n1 - 1.5) < 0.005 and abs(n2 - 1) < 0.005 and not tir and rr > 85*pi/180",
      },
      { text: "Make total internal reflection happen", check: "tir" },
    ],
    accent: OPTICS_ACCENT,
    build: snellsLaw,
  },
  {
    key: "geo_optics_slab",
    category: "Optics",
    title: "Glass Slab",
    topic: "Refraction",
    summary: "The ray comes out parallel to how it went in, shifted sideways.",
    facts: [
      "At the top face sin i = n sin r; at the bottom n sin r = sin e, so e = i.",
      "The emergent ray is parallel to the incident ray, displaced sideways.",
      "Lateral shift d = t sin(i − r) ÷ cos r: more for a thicker slab, a larger n, or a larger angle.",
    ],
    tryThis: ["Change the angle and the thickness and watch the shift d.", "Set n = 1: no slab at all."],
    challenges: [
      { text: "Make the shift zero (two ways)", check: "shift < 0.005" },
      { text: "Make the shift exactly 1", check: "abs(shift - 1) < 0.02" },
    ],
    proof: [
      "The top and bottom faces are parallel, so the angle inside meets both faces at the same r.",
      "Top: sin i = n sin r. Bottom: n sin r = sin e. So sin e = sin i, and e = i.",
    ],
    accent: OPTICS_ACCENT,
    build: glassSlab,
  },
  {
    key: "geo_optics_prism",
    category: "Optics",
    title: "Prism & Dispersion",
    topic: "Refraction",
    summary: "Deviation δ = i + e − A, least when the ray passes through symmetrically; white light splits into colours.",
    facts: [
      "Inside the prism r₁ + r₂ = A (the prism angle).",
      "The deviation is δ = i + e − A.",
      "δ is least when i = e (the ray goes through symmetrically); then n = sin((A + δₘ)/2) ÷ sin(A/2).",
      "n is slightly bigger for violet than for red, so violet bends most: dispersion makes a spectrum (VIBGYOR).",
    ],
    tryThis: ["Turn the ray slowly and watch δ fall, then rise again.", "Make the prism angle bigger until the light can't get out."],
    challenges: [
      { text: "Find the angle of least deviation (i = e)", check: "se(ng) <= 1 and abs(inc - e) < 0.5" },
      { text: "Trap the light: total internal reflection at the second face", check: "se(ng) > 1" },
    ],
    proof: [
      "The two normals meet at the same angle A as the faces, so in the triangle they make with the ray inside, r₁ + r₂ = A.",
      "The ray turns by (i − r₁) at the first face and by (e − r₂) at the second.",
      "In total δ = i + e − (r₁ + r₂) = i + e − A.",
    ],
    accent: OPTICS_ACCENT,
    build: prism,
  },
  {
    key: "geo_optics_convex_lens",
    category: "Optics",
    title: "Convex Lens",
    topic: "Lenses",
    summary: "A converging lens: ray diagrams, 1/v − 1/u = 1/f and magnification.",
    facts: [
      "Lens formula 1/v − 1/u = 1/f, distances from the lens with the Cartesian sign convention (u is negative; f is positive for a convex lens).",
      "Magnification m = h′/h = v/u. Negative m: inverted.",
      "Three easy rays: in parallel → out through F; through the centre O → straight on; through F → out parallel.",
      "Object beyond 2F: real, inverted, smaller. At 2F: same size. Between F and 2F: magnified. Inside F: virtual, upright, magnified (a magnifying glass).",
      "Power P = 1/f (f in metres), in dioptres.",
    ],
    tryThis: ["Drag the object from far away towards the lens and watch the image.", "Drag F to change the focal length."],
    challenges: [
      { text: "Put the object at 2F: the image is the same size, at 2F on the other side", check: "abs(u + 2*fl) < 0.05" },
      { text: "Make the image three times as tall, real and inverted", check: "v > 0 and abs(v/u + 3) < 0.05" },
      { text: "Use it as a magnifying glass: a virtual, upright image", check: "v < 0" },
    ],
    proof: [
      "The ray through O goes straight on, so the image tip is on the line through the object tip and O: h′/h = v/u.",
      "The parallel ray leaves the lens at height h and crosses the axis at F, so at distance v its height is h′ = h(1 − v/f).",
      "So v/u = 1 − v/f. Divide by v: 1/u = 1/v − 1/f, that is 1/v − 1/u = 1/f.",
    ],
    accent: OPTICS_ACCENT,
    build: () => thinLens("gop_lens", true),
  },
  {
    key: "geo_optics_concave_lens",
    category: "Optics",
    title: "Concave Lens",
    topic: "Lenses",
    summary: "A diverging lens: always a virtual, upright, smaller image.",
    facts: [
      "The same formula 1/v − 1/u = 1/f, with f negative for a concave lens.",
      "Rays in parallel spread out as if from the focus F on the object's side.",
      "The image is always virtual, upright and diminished, between F and the lens.",
    ],
    tryThis: ["Drag the object anywhere: the image never leaves the gap between F and the lens."],
    challenges: [{ text: "Make the image exactly half the object's height", check: "abs(v/u - 0.5) < 0.01" }],
    accent: OPTICS_ACCENT,
    build: () => thinLens("gop_diverge", false),
  },
  {
    key: "geo_optics_concave_mirror",
    category: "Optics",
    title: "Concave Mirror",
    topic: "Mirrors",
    summary: "A converging mirror: ray diagrams, 1/v + 1/u = 1/f, real and virtual images.",
    facts: [
      "Mirror formula 1/v + 1/u = 1/f, with f = R/2 (R the radius of curvature, C its centre); f is negative for a concave mirror.",
      "Magnification m = h′/h = −v/u.",
      "Three easy rays: in parallel → back through F; to the pole P → back at the same angle; through F → back parallel.",
      "Object beyond C: real, inverted, smaller. At C: same size. Between C and F: magnified. Inside F: virtual, upright, magnified (a shaving or make-up mirror).",
    ],
    tryThis: ["Bring the object in from far away, past C, then past F."],
    challenges: [
      { text: "Put the object at C: the image is at C too, the same size", check: "abs(u + 2*fl) < 0.05" },
      { text: "Make a virtual, upright image (a make-up mirror)", check: "v > 0" },
    ],
    accent: OPTICS_ACCENT,
    build: () => curvedMirror("gop_concave", true),
  },
  {
    key: "geo_optics_convex_mirror",
    category: "Optics",
    title: "Convex Mirror",
    topic: "Mirrors",
    summary: "A diverging mirror: a small, upright image and a wide view.",
    facts: [
      "The same formula 1/v + 1/u = 1/f, with f positive for a convex mirror.",
      "The image is always virtual, upright and diminished, behind the mirror between P and F.",
      "It shows a wide field of view, which is why it is used as a vehicle's rear-view mirror.",
    ],
    tryThis: ["Drag the object near and far: the image stays small and behind the mirror."],
    challenges: [{ text: "Make the image half the object's height", check: "abs(-v/u - 0.5) < 0.01" }],
    accent: OPTICS_ACCENT,
    build: () => curvedMirror("gop_mirror", false),
  },
];
