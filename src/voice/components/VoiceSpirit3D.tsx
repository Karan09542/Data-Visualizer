import React, { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import type * as ThreeNS from "three";
import { useDraggable } from "../../hooks/useDraggable";

/**
 * The voice button's mascot: the Kailash crystal spirit, in three.js.
 *
 * The model is public/kailash_sprit_icon.glb, an optimized copy of kailash_sprit.glb (19 MB →
 * 317 KB: mesh simplified to ~29k triangles, 512 px WebP textures, meshopt-compressed geometry).
 * Re-create it from the original with:
 *   npx @gltf-transform/cli optimize kailash_sprit.glb kailash_sprit_icon.glb \
 *     --compress meshopt --texture-compress webp --texture-size 512 --simplify-ratio 0.1 --simplify-error 0.002
 *
 * It floats at rest; while listening it bops along as if to its headphones and its face glows with
 * the sound; while matching it looks side to side; on a match it spins for joy, on an error it
 * shakes its head. At rest it renders at a low frame rate; with reduced motion it holds still.
 */

export type SpiritMode = "idle" | "listening" | "processing" | "success" | "error";

export interface VoiceSpirit3DProps {
  mode: SpiritMode;
  size?: number;
  className?: string;
  draggable?: boolean;
}

const MODEL_URL = `${import.meta.env.BASE_URL}kailash_sprit_icon.glb`;
/** Frame rate for the gentle float at rest. */
const IDLE_FPS = 24;
/** The model is scaled to this height in scene units; the camera frames it with room to move. */
const MODEL_HEIGHT = 2;
/** Bops per second while listening. */
const BOP_HZ = 2;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const VoiceSpirit3D: React.FC<VoiceSpirit3DProps> = ({ mode, size = 64, className, draggable = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const kickRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const { targetRef, dragProps } = useDraggable({
    storageKey: "voice-spirit-3d-pos",
    disabled: !draggable,
    edgePadding: 16,
    defaultPosition: () => ({
      x: typeof window !== "undefined" ? Math.max(16, window.innerWidth - (size + 24)) : 24,
      y: typeof window !== "undefined" ? Math.max(16, window.innerHeight - (size + 24)) : 24,
    }),
  });

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      let THREE: typeof ThreeNS;
      let gltf: { scene: ThreeNS.Group };
      try {
        THREE = await import("three");
        const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
          import("three/examples/jsm/loaders/GLTFLoader.js"),
          import("three/examples/jsm/libs/meshopt_decoder.module.js"),
        ]);
        gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL_URL);
      } catch (e) {
        console.error("Voice spirit failed to load:", e);
        if (!disposed) setFailed(true);
        return;
      }
      const canvas = canvasRef.current;
      if (disposed || !canvas) return;

      let renderer: ThreeNS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
      } catch {
        setFailed(true); // no WebGL: the plain mic icon stands in
        return;
      }
      // Draw at least 2x: at 64 px the face and crystals need the extra pixels.
      renderer.setPixelRatio(Math.min(3, Math.max(2, window.devicePixelRatio || 1)));
      renderer.setSize(size, size, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
      camera.position.set(0, 0, 4.0);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x1e1b4b, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2);
      key.position.set(2, 3, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x67e8f9, 1.4);
      rim.position.set(-3, 1, -2);
      scene.add(rim);

      // A soft aura behind the spirit, brighter while it listens.
      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = glowCanvas.height = 64;
      const g2d = glowCanvas.getContext("2d")!;
      const grad = g2d.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.3, "rgba(255,255,255,0.45)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g2d.fillStyle = grad;
      g2d.fillRect(0, 0, 64, 64);
      const glowTex = new THREE.CanvasTexture(glowCanvas);
      const auraMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x22d3ee, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
      const aura = new THREE.Sprite(auraMat);
      aura.scale.setScalar(2.6);
      aura.position.z = -0.8;
      scene.add(aura);

      // Centre the model on its bounding box and scale it to a known height.
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const scale = MODEL_HEIGHT / box.getSize(new THREE.Vector3()).y;
      model.position.copy(center).multiplyScalar(-scale);
      model.scale.setScalar(scale);
      const spirit = new THREE.Group();
      spirit.add(model);
      scene.add(spirit);

      // The face, headphones and crystals glow through the emissive map: tinting it tints them.
      const glowing: ThreeNS.MeshStandardMaterial[] = [];
      model.traverse((o) => {
        const mesh = o as ThreeNS.Mesh;
        if (!mesh.isMesh) return;
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if ((m as ThreeNS.MeshStandardMaterial).isMeshStandardMaterial) glowing.push(m as ThreeNS.MeshStandardMaterial);
        }
      });
      const white = new THREE.Color(0xffffff);
      const tint = new THREE.Color();

      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

      let raf = 0;
      let lastFrame = 0;
      let t = 0;
      /** How much of each mode's motion is showing, eased so changes blend. */
      let listen = 0;
      let think = 0;
      let flash = 0;
      /** When the current success spin or error shake started, in scene time. */
      let reactAt = -10;
      let reaction: "spin" | "shake" | null = null;
      let prevMode: SpiritMode = modeRef.current;

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const m = modeRef.current;
        const listenTarget = m === "listening" ? 1 : 0;
        const thinkTarget = m === "processing" ? 1 : 0;
        const reacting = reaction !== null && t - reactAt < 0.8;
        const resting = listen === 0 && think === 0 && flash === 0 && !reacting && listenTarget === 0 && thinkTarget === 0;

        if (still && resting && lastFrame) {
          cancelAnimationFrame(raf);
          raf = 0;
          return;
        }
        // At rest it only floats: a low frame rate is plenty.
        if (resting && lastFrame && now - lastFrame < 1000 / IDLE_FPS) return;

        const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
        lastFrame = now;
        t += dt;

        if (m !== prevMode) {
          if (m === "success") tint.set(0x4ade80), (flash = 1), (reaction = "spin"), (reactAt = t);
          if (m === "error") tint.set(0xfbbf24), (flash = 1), (reaction = "shake"), (reactAt = t);
          prevMode = m;
        }
        const ease = Math.min(1, dt * 6);
        listen += (listenTarget - listen) * ease;
        think += (thinkTarget - think) * ease;
        if (Math.abs(listenTarget - listen) < 0.002) listen = listenTarget;
        if (Math.abs(thinkTarget - think) < 0.002) think = thinkTarget;
        flash = Math.max(0, flash - dt * 1.4);

        if (still) {
          spirit.position.set(0, 0, 0);
          spirit.rotation.set(0, 0, 0);
        } else {
          const rest = 1 - Math.max(listen, think);
          const beat = t * Math.PI * 2 * BOP_HZ;
          // Float at rest; bop to the beat while listening (a bounce, never dipping below rest).
          spirit.position.y = rest * 0.05 * Math.sin(t * 1.6) + listen * 0.07 * Math.abs(Math.sin(beat / 2));
          let yaw = rest * 0.18 * Math.sin(t * 0.55) + think * 0.5 * Math.sin(t * 2.2);
          spirit.rotation.z = listen * 0.09 * Math.sin(beat / 2) + think * 0.06;
          // Leans in toward the speaker while listening.
          spirit.rotation.x = listen * 0.12;

          const since = t - reactAt;
          if (reaction === "spin" && since < 0.8) {
            yaw += Math.PI * 2 * easeOutCubic(since / 0.8);
            spirit.position.y += 0.15 * Math.sin(Math.PI * Math.min(1, since / 0.5));
          } else if (reaction === "shake" && since < 0.6) {
            yaw += 0.35 * Math.sin(since * 30) * (1 - since / 0.6);
          } else {
            reaction = null;
          }
          spirit.rotation.y = yaw;
        }

        // The glow pulses with the sound while listening, and takes the success/error colour.
        const pulse = 1 + listen * 0.7 * (0.5 + 0.5 * Math.sin(t * 9)) + think * 0.3;
        for (const mat of glowing) {
          mat.emissive.copy(white).lerp(tint, flash);
          mat.emissiveIntensity = pulse + flash * 0.8;
        }
        auraMat.opacity = 0.15 + 0.4 * listen + 0.2 * think + 0.3 * flash;
        auraMat.color.set(0x22d3ee).lerp(tint, flash);

        renderer.render(scene, camera);
      };

      const kick = () => {
        if (!raf) {
          lastFrame = 0;
          raf = requestAnimationFrame(frame);
        }
      };
      kickRef.current = kick;

      const onLost = (e: Event) => {
        e.preventDefault();
        setFailed(true);
      };
      canvas.addEventListener("webglcontextlost", onLost);

      kick();
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        canvas.removeEventListener("webglcontextlost", onLost);
        kickRef.current = () => {};
        model.traverse((o) => {
          const mesh = o as ThreeNS.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            for (const value of Object.values(mat)) if ((value as ThreeNS.Texture)?.isTexture) (value as ThreeNS.Texture).dispose();
            mat.dispose();
          }
        });
        glowTex.dispose();
        auraMat.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [size]);

  useEffect(() => {
    kickRef.current();
  }, [mode]);

  const content = failed ? (
    <Mic className={className} style={{ width: size * 0.4, height: size * 0.4 }} />
  ) : (
    <span className={`relative inline-block ${className ?? ""}`} style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ width: size, height: size, opacity: ready ? 1 : 0, transition: "opacity 300ms" }} aria-hidden />
      {/* Shown while the model loads (about 300 KB, once). */}
      {!ready && <Mic className="absolute inset-0 m-auto opacity-70" style={{ width: size * 0.4, height: size * 0.4 }} />}
    </span>
  );

  if (draggable) {
    return (
      <div
        ref={targetRef}
        {...dragProps}
        style={{
          ...dragProps.style,
          zIndex: 9999,
          width: size,
          height: size,
        }}
        className="fixed select-none cursor-grab active:cursor-grabbing"
      >
        {content}
      </div>
    );
  }

  return content;
};

