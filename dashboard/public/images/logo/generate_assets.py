import os
import sys
import math

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    print("PIL (Pillow) is required. Installing...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw, ImageFilter

def generate_png(output_path, size=512):
    # Create transparent image
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Scale helper
    def s(val):
        return int(val * (size / 512.0))
    
    # Hexagon points
    hex_pts = [
        (s(256), s(30)),
        (s(452), s(143)),
        (s(452), s(369)),
        (s(256), s(482)),
        (s(60), s(369)),
        (s(60), s(143))
    ]
    
    # Draw glow behind hexagon (outer border)
    # We draw a thick hexagon outline on a temporary image and blur it
    glow_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    glow_draw.polygon(hex_pts, outline=(110, 90, 124, 180), width=s(16))
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(s(8)))
    img.alpha_composite(glow_img)
    
    # Draw Hexagon Border
    # Draw with a gradient approximation: purple to cyan border
    draw.polygon(hex_pts, outline=(110, 156, 170, 255), width=s(8))
    
    # Draw internal dashed grid lines
    grid_color = (51, 49, 59, 120)
    draw.line([(s(256), s(30)), (s(256), s(150))], fill=grid_color, width=s(2))
    draw.line([(s(60), s(143)), (s(160), s(200))], fill=grid_color, width=s(2))
    draw.line([(s(452), s(143)), (s(352), s(200))], fill=grid_color, width=s(2))
    draw.line([(s(60), s(369)), (s(160), s(312))], fill=grid_color, width=s(2))
    draw.line([(s(452), s(369)), (s(352), s(312))], fill=grid_color, width=s(2))
    draw.line([(s(256), s(482)), (s(256), s(362))], fill=grid_color, width=s(2))
    
    # Robot Head Top
    draw.polygon([
        (s(160), s(200)),
        (s(352), s(200)),
        (s(392), s(250)),
        (s(120), s(250))
    ], fill=(126, 95, 160, 230))
    
    # Robot Eye Visor (Cyan Glow)
    visor_pts = [
        (s(135), s(260)),
        (s(377), s(260)),
        (s(362), s(300)),
        (s(150), s(300))
    ]
    
    # Glow for visor
    visor_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    vg_draw = ImageDraw.Draw(visor_glow)
    vg_draw.polygon(visor_pts, fill=(8, 145, 178, 255))
    visor_glow = visor_glow.filter(ImageFilter.GaussianBlur(s(4)))
    img.alpha_composite(visor_glow)
    
    # Base Visor
    draw.polygon(visor_pts, fill=(8, 145, 178, 220))
    draw.line([(s(160), s(280)), (s(352), s(280))], fill=(255, 255, 255, 200), width=s(3))
    
    # Robot Jaw/Mouth
    draw.polygon([
        (s(160), s(310)),
        (s(352), s(310)),
        (s(312), s(370)),
        (s(200), s(370))
    ], fill=(90, 63, 117, 220))
    
    # Draw circular wrapping transaction arrows
    # Top arrow (Left-to-Right)
    for angle in range(-150, -30, 2):
        rad = math.radians(angle)
        x = s(256) + int(s(170) * math.cos(rad))
        y = s(256) + int(s(170) * math.sin(rad))
        draw.ellipse([x - s(4), y - s(4), x + s(4), y + s(4)], fill=(110, 156, 170, 200))
    
    # Top Arrow Head
    arrow_top_pts = [
        (s(256) + int(s(170) * math.cos(math.radians(-30))), s(256) + int(s(170) * math.sin(math.radians(-30)))),
        (s(256) + int(s(182) * math.cos(math.radians(-42))), s(256) + int(s(182) * math.sin(math.radians(-42)))),
        (s(256) + int(s(158) * math.cos(math.radians(-42))), s(256) + int(s(158) * math.sin(math.radians(-42))))
    ]
    draw.polygon(arrow_top_pts, fill=(110, 156, 170, 255))
    
    # Bottom arrow (Right-to-Left)
    for angle in range(30, 150, 2):
        rad = math.radians(angle)
        x = s(256) + int(s(170) * math.cos(rad))
        y = s(256) + int(s(170) * math.sin(rad))
        draw.ellipse([x - s(4), y - s(4), x + s(4), y + s(4)], fill=(110, 90, 124, 200))
        
    # Bottom Arrow Head
    arrow_bot_pts = [
        (s(256) + int(s(170) * math.cos(math.radians(150))), s(256) + int(s(170) * math.sin(math.radians(150)))),
        (s(256) + int(s(182) * math.cos(math.radians(138))), s(256) + int(s(182) * math.sin(math.radians(138)))),
        (s(256) + int(s(158) * math.cos(math.radians(138))), s(256) + int(s(158) * math.sin(math.radians(138))))
    ]
    draw.polygon(arrow_bot_pts, fill=(110, 90, 124, 255))
    
    # Save Image
    img.save(output_path, "PNG")
    print(f"Generated PNG: {output_path}")
    return img

def generate_svg(output_path):
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Gradients -->
    <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7E5FA0" />
      <stop offset="100%" stop-color="#5A3F75" />
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0891B2" />
      <stop offset="100%" stop-color="#0E7490" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A78FB5" />
      <stop offset="50%" stop-color="#7FA8A8" />
      <stop offset="100%" stop-color="#C99AB0" />
    </linearGradient>
    <!-- Filter for subtle glow -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  
  <!-- Outer Hexagon -->
  <polygon points="256,30 452,143 452,369 256,482 60,369 60,143" fill="none" stroke="url(#glowGrad)" stroke-width="12" stroke-linejoin="round" filter="url(#glow)" />
  
  <!-- Subtle Internal Chip Grid -->
  <line x1="256" y1="30" x2="256" y2="150" stroke="#33313B" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />
  <line x1="60" y1="143" x2="160" y2="200" stroke="#33313B" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />
  <line x1="452" y1="143" x2="352" y2="200" stroke="#33313B" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />
  <line x1="60" y1="369" x2="160" y2="312" stroke="#33313B" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />
  <line x1="452" y1="369" x2="352" y2="312" stroke="#33313B" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />
  <line x1="256" y1="482" x2="256" y2="362" stroke="#33313B" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />
  
  <!-- Robot Head structure -->
  <path d="M160,200 L352,200 L392,250 L120,250 Z" fill="url(#purpleGrad)" opacity="0.9" />
  <polygon points="135,260 377,260 362,300 150,300" fill="url(#cyanGrad)" filter="url(#glow)" />
  <line x1="160" y1="280" x2="352" y2="280" stroke="#FFFFFF" stroke-width="3" opacity="0.8" filter="url(#glow)" />
  <polygon points="160,310 352,310 312,370 200,370" fill="url(#purpleGrad)" opacity="0.85" />
  
  <!-- Transaction / Airdrop Arrows -->
  <path d="M 100,180 A 180,180 0 0,1 412,180" fill="none" stroke="url(#glowGrad)" stroke-width="8" stroke-linecap="round" opacity="0.85" />
  <polygon points="412,180 400,165 430,180 400,195" fill="url(#glowGrad)" />
  
  <path d="M 412,332 A 180,180 0 0,1 100,332" fill="none" stroke="url(#glowGrad)" stroke-width="8" stroke-linecap="round" opacity="0.85" />
  <polygon points="100,332 112,317 82,332 112,347" fill="url(#glowGrad)" />
</svg>
"""
    with open(output_path, "w") as f:
        f.write(svg_content)
    print(f"Generated SVG: {output_path}")

def main():
    logo_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(logo_dir, exist_ok=True)
    
    png_path = os.path.join(logo_dir, "logo.png")
    svg_path = os.path.join(logo_dir, "logo.svg")
    
    # Generate original assets
    img = generate_png(png_path)
    generate_svg(svg_path)
    
    # Generate multi-size favicon.ico
    favicon_path = os.path.join(logo_dir, "favicon.ico")
    img.save(favicon_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f"Generated Favicon: {favicon_path}")

if __name__ == "__main__":
    main()
