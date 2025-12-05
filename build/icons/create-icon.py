#!/usr/bin/env python3
"""
Create a high-quality app icon for HyperWallet
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size=1024):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Colors: Indigo to Purple gradient
    center = size // 2
    radius = int(size * 0.45)
    
    # Draw gradient background (circular)
    for i in range(radius, 0, -1):
        # Gradient from indigo (#6366f1) to purple (#8b5cf6)
        ratio = i / radius
        r = int(99 + (139 - 99) * (1 - ratio))  # 99 -> 139
        g = int(102 + (92 - 102) * (1 - ratio))  # 102 -> 92
        b = int(241 + (246 - 241) * (1 - ratio)) # 241 -> 246
        
        # Create color with alpha for smooth edges
        alpha = 255 if i > radius * 0.9 else int(255 * (i / (radius * 0.9)))
        color = (r, g, b, alpha)
        draw.ellipse(
            [center - i, center - i, center + i, center + i],
            fill=color,
            outline=None
        )
    
    # Draw wallet shape
    wallet_width = int(size * 0.5)
    wallet_height = int(size * 0.375)
    wallet_x = center - wallet_width // 2
    wallet_y = center - wallet_height // 2 + int(size * 0.05)
    corner_radius = int(size * 0.03)
    
    # Wallet body (white/light)
    wallet_rect = [
        wallet_x, wallet_y,
        wallet_x + wallet_width, wallet_y + wallet_height
    ]
    draw.rounded_rectangle(
        wallet_rect,
        radius=corner_radius,
        fill=(255, 255, 255, 240),
        outline=None
    )
    
    # Wallet flap/cover (slightly darker)
    flap_points = [
        (wallet_x, wallet_y),
        (center, wallet_y - int(size * 0.1)),
        (wallet_x + wallet_width, wallet_y)
    ]
    draw.polygon(flap_points, fill=(255, 255, 255, 220))
    
    # Wallet opening line
    line_y = wallet_y + int(size * 0.08)
    draw.line(
        [wallet_x, line_y, wallet_x + wallet_width, line_y],
        fill=(99, 102, 241, 100),
        width=int(size * 0.008)
    )
    
    # Card slots
    slot_width = int(wallet_width * 0.75)
    slot_height = int(size * 0.047)
    slot_x = center - slot_width // 2
    slot_y1 = wallet_y + int(size * 0.16)
    slot_y2 = wallet_y + int(size * 0.24)
    
    draw.rounded_rectangle(
        [slot_x, slot_y1, slot_x + slot_width, slot_y1 + slot_height],
        radius=int(size * 0.008),
        fill=(229, 231, 235, 150),
        outline=None
    )
    draw.rounded_rectangle(
        [slot_x, slot_y2, slot_x + int(slot_width * 0.83), slot_y2 + slot_height],
        radius=int(size * 0.008),
        fill=(229, 231, 235, 100),
        outline=None
    )
    
    # Letter "H" for HyperWallet
    try:
        # Try to use a system font
        font_size = int(size * 0.2)
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/Library/Fonts/Arial Bold.ttf", font_size)
        except:
            # Fallback to default font
            font = ImageFont.load_default()
    
    text = "H"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = center - text_width // 2
    text_y = wallet_y + wallet_height + int(size * 0.08)
    
    # Draw text with gradient effect (using the gradient color)
    draw.text(
        (text_x, text_y),
        text,
        fill=(99, 102, 241, 200),
        font=font
    )
    
    # Add shine effect
    shine_x = wallet_x + int(wallet_width * 0.2)
    shine_y = wallet_y + int(wallet_height * 0.15)
    shine_size = int(size * 0.12)
    draw.ellipse(
        [shine_x, shine_y, shine_x + shine_size, shine_y + int(shine_size * 0.7)],
        fill=(255, 255, 255, 80),
        outline=None
    )
    
    return img

def main():
    output_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Create 1024x1024 icon
    print("Creating 1024x1024 icon...")
    icon = create_icon(1024)
    icon_path = os.path.join(output_dir, 'icon.png')
    icon.save(icon_path, 'PNG', optimize=True)
    print(f"✓ Created {icon_path}")
    
    # Create smaller versions for different uses
    sizes = [512, 256, 128, 64, 32, 16]
    for size in sizes:
        small_icon = create_icon(size)
        small_path = os.path.join(output_dir, f'icon_{size}x{size}.png')
        small_icon.save(small_path, 'PNG', optimize=True)
        print(f"✓ Created {small_path}")

if __name__ == '__main__':
    main()

