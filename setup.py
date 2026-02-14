#!/usr/bin/env python3
"""
Setup script for ComfyUI Photoshop Plugin
Initializes default workflows and validates the environment
"""

import os
import sys
import json
import subprocess
from pathlib import Path


def print_header(text):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60 + "\n")


def check_comfyui_running():
    """Check if ComfyUI server is accessible"""
    import urllib.request
    import urllib.error
    
    try:
        response = urllib.request.urlopen("http://127.0.0.1:8188/system_stats", timeout=5)
        if response.status == 200:
            return True
    except (urllib.error.URLError, urllib.error.HTTPError):
        return False
    return False


def create_directory_structure():
    """Create necessary directories"""
    print_header("Creating Directory Structure")
    
    directories = [
        "workflows",
        "icons",
        "output",
        "temp"
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"✓ Created: {directory}/")
    
    print("\n✓ Directory structure ready!")


def initialize_workflows():
    """Initialize default workflow files"""
    print_header("Initializing Workflows")
    
    try:
        from workflow_manager import initialize_default_workflows
        initialize_default_workflows()
        print("\n✓ Default workflows created!")
    except ImportError:
        print("⚠ workflow_manager.py not found, skipping workflow initialization")
    except Exception as e:
        print(f"⚠ Error initializing workflows: {e}")


def create_placeholder_icon():
    """Create a placeholder icon"""
    print_header("Creating Placeholder Icon")
    
    try:
        from PIL import Image, ImageDraw
        
        # Create a simple placeholder icon
        img = Image.new('RGB', (48, 48), color='#0d99ff')
        draw = ImageDraw.Draw(img)
        
        # Draw "CF" text
        draw.text((8, 12), "CF", fill='white')
        
        img.save("icons/icon.png")
        print("✓ Placeholder icon created!")
    except ImportError:
        print("⚠ Pillow not installed, skipping icon creation")
        print("  You can create your own icon.png file (48x48) in the icons/ folder")


def validate_manifest():
    """Validate manifest.json"""
    print_header("Validating Manifest")
    
    try:
        with open("manifest.json", 'r') as f:
            manifest = json.load(f)
        
        required_fields = ["id", "name", "version", "main", "host", "entrypoints"]
        for field in required_fields:
            if field not in manifest:
                print(f"⚠ Missing required field: {field}")
                return False
        
        print("✓ Manifest is valid!")
        return True
    except FileNotFoundError:
        print("✗ manifest.json not found!")
        return False
    except json.JSONDecodeError:
        print("✗ manifest.json is not valid JSON!")
        return False


def check_dependencies():
    """Check for required dependencies"""
    print_header("Checking Dependencies")
    
    # Check Python packages
    python_packages = ["Pillow"]
    
    for package in python_packages:
        try:
            __import__(package.lower())
            print(f"✓ {package} is installed")
        except ImportError:
            print(f"⚠ {package} is not installed (optional)")
    
    # Check ComfyUI
    if check_comfyui_running():
        print("✓ ComfyUI server is running")
    else:
        print("⚠ ComfyUI server is not running")
        print("  Start ComfyUI with: python main.py")


def print_next_steps():
    """Print instructions for next steps"""
    print_header("Next Steps")
    
    print("1. Start ComfyUI (if not already running):")
    print("   cd /path/to/ComfyUI")
    print("   python main.py")
    print()
    print("2. Open Photoshop")
    print()
    print("3. Open UXP Developer Tool:")
    print("   Plugins → Development → UXP Developer Tool")
    print()
    print("4. Load the plugin:")
    print("   Click 'Add Plugin' → Select manifest.json")
    print("   Click 'Load'")
    print()
    print("5. Find the plugin panel:")
    print("   Plugins → ComfyUI Integration")
    print()
    print("6. Test the connection and start generating!")
    print()
    print("For more information, see README.md")


def main():
    """Main setup function"""
    print_header("ComfyUI Photoshop Plugin Setup")
    
    print("This script will set up your ComfyUI Photoshop Plugin environment.")
    print()
    
    # Run setup steps
    create_directory_structure()
    initialize_workflows()
    create_placeholder_icon()
    validate_manifest()
    check_dependencies()
    print_next_steps()
    
    print("\n" + "=" * 60)
    print("  Setup Complete!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nSetup interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ Setup failed with error: {e}")
        sys.exit(1)
