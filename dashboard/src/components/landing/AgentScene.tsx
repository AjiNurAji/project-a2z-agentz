"use client";

import React, { useEffect, useRef, useCallback } from "react";

interface AgentSceneProps {
  isTransitioning: boolean;
  onTransitionComplete: () => void;
}

/* ============================================================
   Pro-Max Particle Network Configuration
   ============================================================ */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  size: number;
  colorHue: number; // 180 (Cyan) to 270 (Purple) to 320 (Pink)
  opacity: number;
  layer: "bg" | "fg"; // Depth layers
  isGlitching: boolean;
}

interface FloatingIcon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  symbol: string;
  hueOffset: number;
}

const PARTICLE_COUNT = 150; // High Density
const CONNECTION_DISTANCE = 120;
const ICON_COUNT = 20;
const MOUSE_REPULSION_RADIUS = 200;
const MOUSE_REPULSION_FORCE = 0.05;

const ICON_SYMBOLS = [
  "⬡", "₿", "◈", "⬢", // Crypto
  "⬗", "◉", "⏣", // AI
  "⟐", "✦", "◇", // Airdrop
  "⟁", "⎔", "◬" // Blockchain/Tech
];

export default function AgentScene({
  isTransitioning,
  onTransitionComplete,
}: AgentSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const iconsRef = useRef<FloatingIcon[]>([]);
  
  // Mouse Interaction State
  const mouseRef = useRef({ x: -1000, y: -1000, vx: 0, vy: 0 });
  const timeRef = useRef(0);

  // Handle transition timeline
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        onTransitionComplete();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, onTransitionComplete]);

  // Track Mouse Movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // Initialize particles
  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isForeground = Math.random() > 0.6; // 40% foreground, 60% background
      const baseHue = Math.random() > 0.5 ? 180 : 270; // Start with Cyan or Purple
      
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseX: 0, // Will be updated in loop
        baseY: 0,
        vx: (Math.random() - 0.5) * (isForeground ? 0.6 : 0.2), // Fg moves faster
        vy: (Math.random() - 0.5) * (isForeground ? 0.6 : 0.2),
        size: isForeground ? Math.random() * 2 + 1.5 : Math.random() * 1.5 + 0.5,
        colorHue: baseHue + (Math.random() * 20 - 10),
        opacity: isForeground ? 0.3 + Math.random() * 0.4 : 0.1 + Math.random() * 0.2,
        layer: isForeground ? "fg" : "bg",
        isGlitching: false,
      });
    }
    return particles;
  }, []);

  // Initialize floating icons
  const initIcons = useCallback((width: number, height: number) => {
    const icons: FloatingIcon[] = [];
    for (let i = 0; i < ICON_COUNT; i++) {
      icons.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3, 
        vy: (Math.random() - 0.5) * 0.3,
        size: 10 + Math.random() * 25, // Varied sizes for depth
        opacity: 0.05 + Math.random() * 0.15,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.01,
        symbol: ICON_SYMBOLS[Math.floor(Math.random() * ICON_SYMBOLS.length)],
        hueOffset: Math.random() * 60,
      });
    }
    return icons;
  }, []);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);

      particlesRef.current = initParticles(window.innerWidth, window.innerHeight);
      iconsRef.current = initIcons(window.innerWidth, window.innerHeight);
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      timeRef.current += 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Create trailing effect by drawing semi-transparent background
      const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
      ctx.fillStyle = isLightMode ? "rgba(248, 250, 252, 0.3)" : "rgba(19, 17, 28, 0.3)";
      ctx.fillRect(0, 0, w, h);

      const particles = particlesRef.current;
      const icons = iconsRef.current;
      const mouse = mouseRef.current;

      // Glitch Controller
      const isGlobalGlitch = Math.random() < 0.005; // 0.5% chance per frame for global glitch
      
      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Normal movement
        p.x += p.vx;
        p.y += p.vy;

        // Mouse Repulsion (Interactive Parallax)
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < MOUSE_REPULSION_RADIUS) {
          const force = (MOUSE_REPULSION_RADIUS - dist) / MOUSE_REPULSION_RADIUS;
          const pushX = (dx / dist) * force * MOUSE_REPULSION_FORCE * (p.layer === "fg" ? 1.5 : 0.5);
          const pushY = (dy / dist) * force * MOUSE_REPULSION_FORCE * (p.layer === "fg" ? 1.5 : 0.5);
          p.x += pushX * 20;
          p.y += pushY * 20;
        }

        // Color Breathing (shift hue slightly over time)
        p.colorHue += 0.1;
        if (p.colorHue > 320) p.colorHue = 180; // Cycle back to Cyan from Pink
        
        // Random Glitch Effect
        p.isGlitching = isGlobalGlitch || Math.random() < 0.001;
        let drawX = p.x;
        let drawY = p.y;
        
        if (p.isGlitching) {
          drawX += (Math.random() - 0.5) * 20;
          drawY += (Math.random() - 0.5) * 5;
        }

        // Wrap around edges
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        // Draw particle dot
        ctx.beginPath();
        // Foreground particles pulse slightly
        const pulse = p.layer === "fg" ? Math.sin(timeRef.current * 0.05 + i) * 0.5 + 1 : 1;
        ctx.arc(drawX, drawY, p.size * pulse, 0, Math.PI * 2);
        
        // Use HSL for smooth color transitions
        const saturation = p.isGlitching ? "100%" : (isLightMode ? "60%" : "70%");
        const lightness = p.layer === "fg" ? (isLightMode ? "40%" : "65%") : (isLightMode ? "30%" : "45%");
        const opacity = p.isGlitching ? 0.8 : p.opacity;
        
        ctx.fillStyle = `hsla(${p.colorHue}, ${saturation}, ${lightness}, ${opacity})`;
        ctx.fill();
        
        // Glowing effect for foreground particles
        if (p.layer === "fg" && !isLightMode) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = `hsla(${p.colorHue}, 100%, 60%, 0.5)`;
        } else {
          ctx.shadowBlur = 0;
        }
      }

      ctx.shadowBlur = 0; // Reset shadow for lines

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        // Only connect a subset to keep performance high and look less messy
        for (let j = i + 1; j < particles.length; j += 2) {
          const p1 = particles[i];
          const p2 = particles[j];
          
          // Only connect particles in same layer or 1 fg + 1 bg
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            let opacity = (1 - dist / CONNECTION_DISTANCE) * 0.15;
            
            // Highlight connections near mouse
            const distToMouse = Math.sqrt(Math.pow((p1.x + p2.x)/2 - mouse.x, 2) + Math.pow((p1.y + p2.y)/2 - mouse.y, 2));
            if (distToMouse < MOUSE_REPULSION_RADIUS) {
               opacity *= 2.5; // Brighten lines near cursor
            }

            const isGlitchLine = p1.isGlitching || p2.isGlitching;
            if (isGlitchLine) opacity += 0.3;

            // Gradient line color based on particle hues
            const avgHue = (p1.colorHue + p2.colorHue) / 2;
            
            ctx.beginPath();
            ctx.moveTo(p1.isGlitching ? p1.x + (Math.random() - 0.5)*10 : p1.x, p1.isGlitching ? p1.y : p1.y);
            ctx.lineTo(p2.isGlitching ? p2.x + (Math.random() - 0.5)*10 : p2.x, p2.isGlitching ? p2.y : p2.y);
            
            ctx.strokeStyle = `hsla(${avgHue}, ${isLightMode ? '60%' : '80%'}, ${isLightMode ? '40%' : '60%'}, ${opacity})`;
            ctx.lineWidth = isGlitchLine ? 1.5 : (p1.layer === "fg" && p2.layer === "fg" ? 0.8 : 0.3);
            ctx.stroke();
          }
        }
      }

      // Update and draw floating icons (with Parallax)
      for (let i = 0; i < icons.length; i++) {
        const icon = icons[i];

        icon.x += icon.vx;
        icon.y += icon.vy;
        icon.rotation += icon.rotationSpeed;

        // Mouse Parallax for Icons
        const dx = icon.x - mouse.x;
        const dy = icon.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let drawX = icon.x;
        let drawY = icon.y;
        
        if (dist < MOUSE_REPULSION_RADIUS * 1.5) {
          const force = (MOUSE_REPULSION_RADIUS * 1.5 - dist) / (MOUSE_REPULSION_RADIUS * 1.5);
          drawX += (dx / dist) * force * 30; // Push icons away smoothly
          drawY += (dy / dist) * force * 30;
        }

        // Wrap around edges with padding
        if (icon.x < -60) icon.x = w + 60;
        if (icon.x > w + 60) icon.x = -60;
        if (icon.y < -60) icon.y = h + 60;
        if (icon.y > h + 60) icon.y = -60;

        // Draw icon
        ctx.save();
        ctx.translate(drawX, drawY);
        
        // Occasional icon glitch rotation
        if (isGlobalGlitch) {
           ctx.rotate(icon.rotation + (Math.random() - 0.5));
           ctx.scale(1.2, 0.8); // squash/stretch glitch
        } else {
           ctx.rotate(icon.rotation);
        }
        
        ctx.font = `${icon.size}px "Segoe UI Symbol", "Apple Symbols", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Icons pulse their opacity slightly
        const currentOpacity = icon.opacity + Math.sin(timeRef.current * 0.02 + i) * 0.05;
        
        // Base hue cycle + icon offset
        const cycleHue = 200 + Math.sin(timeRef.current * 0.005) * 80; // Cycles between cyan/blue/purple
        ctx.fillStyle = `hsla(${cycleHue + icon.hueOffset}, 70%, ${isLightMode ? '40%' : '70%'}, ${Math.max(0, currentOpacity)})`;
        
        ctx.fillText(icon.symbol, 0, 0);
        
        // Double draw for glitch ghosting
        if (isGlobalGlitch || Math.random() < 0.002) {
          ctx.fillStyle = `hsla(320, 100%, ${isLightMode ? '40%' : '60%'}, ${currentOpacity * 1.5})`; // Pink glitch ghost
          ctx.fillText(icon.symbol, 4, 0);
          ctx.fillStyle = `hsla(180, 100%, ${isLightMode ? '40%' : '60%'}, ${currentOpacity * 1.5})`; // Cyan glitch ghost
          ctx.fillText(icon.symbol, -4, 0);
        }
        
        ctx.restore();
      }
      
      // Draw Global Scanning Line
      const scanY = (timeRef.current * 2) % h;
      ctx.fillStyle = `hsla(180, 100%, ${isLightMode ? '40%' : '50%'}, 0.03)`;
      ctx.fillRect(0, scanY, w, 20);
      ctx.fillStyle = `hsla(270, 100%, ${isLightMode ? '40%' : '60%'}, 0.01)`;
      ctx.fillRect(0, scanY - 40, w, 40);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initParticles, initIcons]);

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden bg-[var(--color-surface)]"
      style={{
        zIndex: 0,
        transition: "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: isTransitioning ? 0 : 1,
      }}
    >
      {/* Interactive Pro-Max Particle Network */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full blend-scene"
        style={{ pointerEvents: "auto" }} // Allow mouse events for interaction
      />

      {/* Extreme Vignette / Depth Gradient */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          background: "radial-gradient(circle at center, transparent 20%, var(--color-surface) 90%, color-mix(in srgb, var(--color-surface) 85%, black) 100%)",
        }}
      />

      {/* Cybernetic Matrix Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, color-mix(in srgb, var(--color-fg-cyan) 20%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in srgb, var(--color-fg-purple) 20%, transparent) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(circle at center, black 40%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 40%, transparent 90%)",
        }}
      />

      {/* Dynamic Glow Blooms */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full blur-[180px] opacity-[0.12] -left-48 -top-48 animate-float-slow pointer-events-none blend-scene"
        style={{
          background: "radial-gradient(circle, var(--color-fg-cyan) 0%, transparent 70%)",
        }}
      />
      <div 
        className="absolute w-[900px] h-[900px] rounded-full blur-[200px] opacity-[0.12] -right-48 -bottom-48 animate-float-medium pointer-events-none blend-scene"
        style={{
          background: "radial-gradient(circle, var(--color-fg-purple) 0%, transparent 70%)",
        }}
      />
      
      {/* High-Tech Pulse Ring Center */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.05] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse-slow blend-scene"
        style={{
          background: "radial-gradient(circle, var(--color-fg-pink) 0%, transparent 60%)",
        }}
      />

      {/* Inline animations */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 30px) scale(1.1); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translate(0, 0) scale(1.05); }
          50% { transform: translate(-30px, -40px) scale(0.95); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.03; transform: translate(-50%, -50%) scale(0.9); }
          50% { opacity: 0.08; transform: translate(-50%, -50%) scale(1.1); }
        }
        .animate-float-slow { animation: float-slow 20s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 18s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
