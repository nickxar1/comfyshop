# Deployment Guide

## Quick Start

### 1. Prerequisites Check

Before deploying, ensure you have:
- ✅ Adobe Photoshop 24.0.0 or later
- ✅ ComfyUI installed and configured
- ✅ Python 3.8+ (for workflow management)
- ✅ Stable Diffusion models in ComfyUI

### 2. Installation

**Option A: Run Setup Script (Recommended)**
```bash
cd comfyui-photoshop-plugin
python setup.py
```

**Option B: Manual Setup**
```bash
# Create directories
mkdir -p workflows icons output temp

# Initialize workflows
python workflow_manager.py

# Verify manifest
cat manifest.json
```

### 3. Load Plugin in Photoshop

1. Open Photoshop
2. Go to **Plugins → Development → UXP Developer Tool**
3. Click **"Add Plugin"**
4. Navigate to `manifest.json` in the plugin folder
5. Click **"Load"**
6. Plugin panel will appear under **Plugins → ComfyUI Integration**

---

## Development Deployment

### Hot Reloading

The UXP Developer Tool supports hot reloading:

1. Make changes to `index.html` or `index.js`
2. Click **"Reload"** in UXP Developer Tool
3. Changes appear immediately in Photoshop

### Debugging

**Enable Debug Mode:**
```javascript
// Add to index.js
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log('[ComfyUI Plugin]', ...args);
}
```

**View Console:**
1. Open Chrome DevTools: **Plugins → Development → UXP Developer Tool → Select Plugin → Debug**
2. Console logs will appear in DevTools

---

## Production Deployment

### Create Distributable Package

**Method 1: Using UXP Packager**
```bash
# Install UXP Packager
npm install -g @adobe/uxp-packager

# Package the plugin
uxp-package --manifest manifest.json --output ComfyUI_Plugin.ccx
```

**Method 2: Manual Packaging**
```bash
# Create a .ccx file (ZIP with different extension)
zip -r ComfyUI_Plugin.ccx manifest.json index.html index.js icons/ workflows/ config.json
```

### Installation for End Users

1. Download `ComfyUI_Plugin.ccx`
2. Double-click the file
3. Photoshop will automatically install the plugin
4. Restart Photoshop
5. Access via **Plugins → ComfyUI Integration**

---

## Custom Workflow Deployment

### For Custom "Add Hat" Workflow

1. **Create the Workflow in ComfyUI:**
   - Design your workflow in ComfyUI web interface
   - Test it thoroughly
   - Export as JSON (API format)

2. **Save to Plugin:**
   ```bash
   # Save as add_hat_workflow.json in workflows/ folder
   cp ~/Downloads/add_hat_workflow.json workflows/
   ```

3. **Update config.json:**
   ```json
   {
     "workflows": {
       "custom_workflows": {
         "add_hat": {
           "file": "add_hat_workflow.json",
           "description": "Add a stylish hat to the subject",
           "category": "object_addition"
         }
       }
     }
   }
   ```

4. **Reload Plugin:**
   - Click "Refresh Workflows" in the plugin panel
   - Your workflow appears in the list

### Workflow Best Practices

**Parameter Placeholders:**
Your workflow should include:
```json
{
  "6": {
    "inputs": {
      "text": "PROMPT_PLACEHOLDER",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  }
}
```

The plugin will replace `PROMPT_PLACEHOLDER` with the user's prompt.

**For Image Input:**
```json
{
  "1": {
    "inputs": {
      "image": "IMAGE_INPUT_PLACEHOLDER",
      "upload": "image"
    },
    "class_type": "LoadImage"
  }
}
```

**For Mask Input:**
```json
{
  "2": {
    "inputs": {
      "image": "MASK_INPUT_PLACEHOLDER",
      "upload": "image"
    },
    "class_type": "LoadImageMask"
  }
}
```

---

## Network Configuration

### Local Network Access

To access ComfyUI from another machine:

1. **Start ComfyUI with external access:**
   ```bash
   python main.py --listen 0.0.0.0
   ```

2. **Update plugin config:**
   ```json
   {
     "comfyui": {
       "server_url": "http://192.168.1.100:8188"
     }
   }
   ```

3. **Firewall rules:**
   ```bash
   # Allow port 8188
   sudo ufw allow 8188
   ```

### Cloud Deployment

**Warning:** ComfyUI is designed for local use. Cloud deployment requires security considerations.

If deploying to cloud:
1. Use HTTPS with valid certificates
2. Implement authentication
3. Set up API rate limiting
4. Use a reverse proxy (nginx/Apache)

**Example nginx config:**
```nginx
server {
    listen 443 ssl;
    server_name comfyui.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8188;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Multi-User Deployment

### For Teams

**Shared ComfyUI Server:**
1. Set up one ComfyUI instance on a powerful machine
2. All team members point to the same server URL
3. Implement a queue system for fairness

**Workflow Library:**
```bash
# Create shared workflow repository
git init workflows
cd workflows
git add *.json
git commit -m "Initial workflows"
git remote add origin https://github.com/yourteam/comfyui-workflows.git
git push -u origin main
```

Team members pull latest workflows:
```bash
cd comfyui-photoshop-plugin/workflows
git pull
```

---

## Troubleshooting Deployment

### Plugin Won't Load

**Check manifest:**
```bash
cat manifest.json | python -m json.tool
```

**Verify file structure:**
```
comfyui-photoshop-plugin/
├── manifest.json
├── index.html
├── index.js
└── icons/
    └── icon.png
```

### Connection Issues

**Test ComfyUI API:**
```bash
curl http://127.0.0.1:8188/system_stats
```

**Check CORS:**
ComfyUI allows all origins by default, but if you've modified it:
```python
# In ComfyUI main.py or server.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Performance Issues

**Optimize workflows:**
- Reduce steps for faster generation
- Use smaller image dimensions
- Disable unnecessary nodes

**Hardware considerations:**
- GPU with 8GB+ VRAM recommended
- SSD for model storage
- 16GB+ system RAM

---

## Version Control

### Git Setup

```bash
# Initialize repository
git init
echo "temp/" >> .gitignore
echo "output/" >> .gitignore
echo "node_modules/" >> .gitignore
echo ".DS_Store" >> .gitignore

# Commit
git add .
git commit -m "Initial commit: ComfyUI Photoshop Plugin"
```

### Versioning Strategy

Update `manifest.json` for each release:
```json
{
  "version": "1.0.0"  // Major.Minor.Patch
}
```

**Changelog format:**
```markdown
## [1.1.0] - 2024-02-12
### Added
- ControlNet support
- Batch processing
- Custom model selection

### Fixed
- Selection mask bug
- Memory leak in polling

### Changed
- Updated UI layout
- Improved error messages
```

---

## Platform-Specific Notes

### Windows

- Use backslashes in paths: `C:\ComfyUI\`
- May need to allow through Windows Firewall
- Test with PowerShell admin rights

### macOS

- Photoshop may require security permissions
- System Preferences → Security & Privacy → Allow Photoshop
- Use forward slashes in paths

### Linux

- Ensure Python3 is default
- Check SELinux/AppArmor policies
- May need to set file permissions: `chmod -R 755 comfyui-photoshop-plugin/`

---

## Monitoring & Maintenance

### Health Checks

Create a monitoring script:
```python
import requests
import time

while True:
    try:
        r = requests.get("http://127.0.0.1:8188/system_stats", timeout=5)
        if r.status_code == 200:
            print(f"✓ {time.ctime()}: ComfyUI OK")
        else:
            print(f"⚠ {time.ctime()}: ComfyUI returned {r.status_code}")
    except:
        print(f"✗ {time.ctime()}: ComfyUI unreachable")
    
    time.sleep(60)
```

### Logging

Enable logging in the plugin:
```javascript
// Add to index.js
class Logger {
  static log(level, message, data) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${level}: ${message}`, data);
    
    // Optionally save to file or send to server
  }
}
```

---

## Support & Resources

- **ComfyUI Docs:** https://github.com/comfyanonymous/ComfyUI
- **Adobe UXP Docs:** https://developer.adobe.com/photoshop/uxp/
- **Issues:** Open an issue on GitHub
- **Discussions:** Join the community forum

---

**Happy Generating! 🎨**
