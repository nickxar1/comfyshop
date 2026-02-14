"""
Example: Creating an "Add Hat" Workflow for Photoshop Plugin

This demonstrates how to create a specialized workflow that adds a hat
to a person in an image using inpainting techniques.
"""

import json


def create_add_hat_workflow():
    """
    Creates a ComfyUI workflow specifically for adding hats to images.
    
    This workflow:
    1. Takes the original image from Photoshop
    2. Takes a selection mask (where the hat should be)
    3. Uses inpainting to add a hat in the selected region
    4. Returns the result to Photoshop
    """
    
    workflow = {
        # Node 1: Load the input image from Photoshop
        "1": {
            "inputs": {
                "image": "IMAGE_INPUT_PLACEHOLDER",
                "upload": "image"
            },
            "class_type": "LoadImage",
            "_meta": {
                "title": "Load Image from Photoshop"
            }
        },
        
        # Node 2: Load the mask (selection) from Photoshop
        "2": {
            "inputs": {
                "image": "MASK_INPUT_PLACEHOLDER",
                "channel": "alpha",
                "upload": "image"
            },
            "class_type": "LoadImageMask",
            "_meta": {
                "title": "Load Selection Mask"
            }
        },
        
        # Node 3: Load the checkpoint model
        "3": {
            "inputs": {
                "ckpt_name": "sd_xl_base_1.0.safetensors"
            },
            "class_type": "CheckpointLoaderSimple",
            "_meta": {
                "title": "Load Model"
            }
        },
        
        # Node 4: Encode the image with the mask for inpainting
        "4": {
            "inputs": {
                "grow_mask_by": 10,
                "pixels": ["1", 0],
                "vae": ["3", 2],
                "mask": ["2", 0]
            },
            "class_type": "VAEEncodeForInpaint",
            "_meta": {
                "title": "Prepare for Inpainting"
            }
        },
        
        # Node 5: Positive prompt conditioning
        # The placeholder will be replaced with user's prompt + "wearing a hat"
        "5": {
            "inputs": {
                "text": "PROMPT_PLACEHOLDER, wearing a stylish hat, high quality, detailed",
                "clip": ["3", 1]
            },
            "class_type": "CLIPTextEncode",
            "_meta": {
                "title": "Positive Prompt"
            }
        },
        
        # Node 6: Negative prompt conditioning
        "6": {
            "inputs": {
                "text": "NEGATIVE_PROMPT_PLACEHOLDER, deformed, blurry, bad quality, bad anatomy, missing parts",
                "clip": ["3", 1]
            },
            "class_type": "CLIPTextEncode",
            "_meta": {
                "title": "Negative Prompt"
            }
        },
        
        # Node 7: Optional LoRA for better hat generation
        # This can be commented out if you don't have a specific LoRA
        "7": {
            "inputs": {
                "lora_name": "detail_tweaker.safetensors",
                "strength_model": 0.7,
                "strength_clip": 0.7,
                "model": ["3", 0],
                "clip": ["3", 1]
            },
            "class_type": "LoraLoader",
            "_meta": {
                "title": "Detail Enhancement LoRA"
            }
        },
        
        # Node 8: Sampler - generates the hat
        "8": {
            "inputs": {
                "seed": 0,  # Will be randomized by plugin
                "steps": 25,
                "cfg": 7.5,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 0.95,  # High denoise for inpainting
                "model": ["7", 0],  # Use LoRA-enhanced model
                "positive": ["5", 0],
                "negative": ["6", 0],
                "latent_image": ["4", 0]
            },
            "class_type": "KSampler",
            "_meta": {
                "title": "Generate Hat"
            }
        },
        
        # Node 9: Decode the latent image
        "9": {
            "inputs": {
                "samples": ["8", 0],
                "vae": ["3", 2]
            },
            "class_type": "VAEDecode",
            "_meta": {
                "title": "Decode Image"
            }
        },
        
        # Node 10: Save the result
        "10": {
            "inputs": {
                "filename_prefix": "ComfyUI_PS_AddHat",
                "images": ["9", 0]
            },
            "class_type": "SaveImage",
            "_meta": {
                "title": "Save Result"
            }
        }
    }
    
    return workflow


def create_add_hat_with_controlnet():
    """
    Advanced version using ControlNet to better preserve the person's pose
    """
    
    workflow = {
        # Nodes 1-3: Same as basic version
        "1": {
            "inputs": {
                "image": "IMAGE_INPUT_PLACEHOLDER",
                "upload": "image"
            },
            "class_type": "LoadImage"
        },
        
        "2": {
            "inputs": {
                "image": "MASK_INPUT_PLACEHOLDER",
                "channel": "alpha",
                "upload": "image"
            },
            "class_type": "LoadImageMask"
        },
        
        "3": {
            "inputs": {
                "ckpt_name": "sd_xl_base_1.0.safetensors"
            },
            "class_type": "CheckpointLoaderSimple"
        },
        
        # Node 4: Load ControlNet (OpenPose for pose preservation)
        "4": {
            "inputs": {
                "control_net_name": "control_openpose.safetensors"
            },
            "class_type": "ControlNetLoader"
        },
        
        # Node 5: Apply ControlNet preprocessor
        "5": {
            "inputs": {
                "image": ["1", 0],
                "preprocessor": "OpenposePreprocessor"
            },
            "class_type": "ControlNetApplyAdvanced"
        },
        
        # Node 6: Encode for inpainting
        "6": {
            "inputs": {
                "grow_mask_by": 10,
                "pixels": ["1", 0],
                "vae": ["3", 2],
                "mask": ["2", 0]
            },
            "class_type": "VAEEncodeForInpaint"
        },
        
        # Node 7: Positive prompt
        "7": {
            "inputs": {
                "text": "PROMPT_PLACEHOLDER, wearing a fashionable hat, maintaining pose",
                "clip": ["3", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        
        # Node 8: Negative prompt
        "8": {
            "inputs": {
                "text": "NEGATIVE_PROMPT_PLACEHOLDER, changing pose, deformed",
                "clip": ["3", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        
        # Node 9: Apply ControlNet to conditioning
        "9": {
            "inputs": {
                "strength": 0.8,
                "conditioning": ["7", 0],
                "control_net": ["4", 0],
                "image": ["5", 0]
            },
            "class_type": "ControlNetApply"
        },
        
        # Node 10: Sampler
        "10": {
            "inputs": {
                "seed": 0,
                "steps": 30,
                "cfg": 7,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 0.95,
                "model": ["3", 0],
                "positive": ["9", 0],  # Use ControlNet conditioned positive
                "negative": ["8", 0],
                "latent_image": ["6", 0]
            },
            "class_type": "KSampler"
        },
        
        # Node 11: Decode
        "11": {
            "inputs": {
                "samples": ["10", 0],
                "vae": ["3", 2]
            },
            "class_type": "VAEDecode"
        },
        
        # Node 12: Save
        "12": {
            "inputs": {
                "filename_prefix": "ComfyUI_PS_AddHat_ControlNet",
                "images": ["11", 0]
            },
            "class_type": "SaveImage"
        }
    }
    
    return workflow


def save_workflows():
    """Save the workflows to JSON files"""
    import os
    
    workflows_dir = "./workflows"
    os.makedirs(workflows_dir, exist_ok=True)
    
    # Basic add hat workflow
    basic_workflow = create_add_hat_workflow()
    with open(os.path.join(workflows_dir, "add_hat_workflow.json"), 'w') as f:
        json.dump(basic_workflow, f, indent=2)
    
    # Advanced add hat with ControlNet
    advanced_workflow = create_add_hat_with_controlnet()
    with open(os.path.join(workflows_dir, "add_hat_controlnet_workflow.json"), 'w') as f:
        json.dump(advanced_workflow, f, indent=2)
    
    print("✓ Created add_hat_workflow.json")
    print("✓ Created add_hat_controlnet_workflow.json")


def create_usage_instructions():
    """Create a markdown file with usage instructions"""
    
    instructions = """
# Add Hat Workflow - Usage Instructions

## Overview
This workflow allows you to add hats to people in your Photoshop images using AI inpainting.

## Prerequisites
- Stable Diffusion XL model installed in ComfyUI
- (Optional) detail_tweaker.safetensors LoRA
- (Advanced) control_openpose.safetensors ControlNet model

## How to Use

### Step 1: Prepare Your Image in Photoshop
1. Open an image with a person
2. Use any selection tool (Lasso, Magic Wand, etc.)
3. Select the area where you want the hat to appear
   - Typically: the top of the head
   - Include some surrounding area for better blending

### Step 2: Open the ComfyUI Plugin
1. Go to Plugins → ComfyUI Integration
2. Select the "add_hat" workflow from the list

### Step 3: Configure the Generation
1. **Prompt**: Describe the hat you want
   - Good examples:
     - "a red baseball cap"
     - "an elegant wide-brimmed sun hat"
     - "a vintage fedora"
     - "a colorful beanie"
   
2. **Negative Prompt** (optional):
   - "deformed, unrealistic, bad quality"

3. **Options**:
   - ✓ Check "Use Current Selection as Mask"
   - ✓ Check "Use Entire Image as Input"

### Step 4: Generate
1. Click "Generate with ComfyUI"
2. Wait for processing (typically 20-60 seconds)
3. The result will automatically import as a new layer

## Tips for Best Results

### Selection Tips
- **Generous selection**: Include extra space around where the hat will be
- **Feathered edges**: Use Select → Modify → Feather (5-10px) for smoother blending
- **Clean background**: Works best when the area behind the head is simple

### Prompt Tips
- **Be specific**: "a black top hat with a red ribbon" works better than just "a hat"
- **Include style**: "photorealistic fedora" or "cartoon-style cap"
- **Mention lighting**: "matching the scene lighting" helps with realism

### Common Prompts
```
"a stylish fedora hat, photorealistic, matching scene lighting"
"a red baseball cap worn backwards"
"an elegant wide-brimmed sun hat with flowers"
"a winter beanie, warm colors, cozy"
"a chef's toque, white, professional"
"a cowboy hat, leather, western style"
```

## Troubleshooting

### Hat doesn't match person's head size
- **Solution**: Adjust your selection to better match the head size
- Try multiple generations with slight prompt variations

### Hat looks unrealistic
- **Solution**: Add to prompt: "photorealistic, natural lighting, high quality"
- Increase the CFG value in the workflow (7-9 range)

### Hat has wrong colors/style
- **Solution**: Be more specific in your prompt
- Use reference images as inspiration for your description

### Selection area still visible
- **Solution**: Expand your selection by 10-20 pixels
- Use a softer feather on the selection edges

## Advanced Usage

### Using the ControlNet Version
The ControlNet version preserves the person's pose better:
1. Select "add_hat_controlnet" workflow
2. Same usage as basic version
3. Better for complex poses or multiple people

### Batch Processing
To add hats to multiple images:
1. Record an action in Photoshop
2. Include: Selection → Plugin execution → Save
3. Use Batch processing (File → Automate → Batch)

### Fine-tuning Results
After generation:
1. Use Photoshop's blending modes
2. Adjust opacity for subtlety
3. Use layer masks to refine edges
4. Color correction to match scene

## Examples

### Example 1: Baseball Cap
```
Selection: Top of head
Prompt: "a navy blue baseball cap worn forwards, realistic"
Result: Clean, natural-looking cap
```

### Example 2: Fancy Hat
```
Selection: Top of head + some shoulders
Prompt: "an elegant Victorian top hat, black silk, photorealistic"
Result: Period-accurate formal hat
```

### Example 3: Casual Beanie
```
Selection: Top of head
Prompt: "a casual knit beanie, gray wool, winter style"
Result: Cozy winter hat
```

## Workflow Customization

You can modify the workflow parameters by editing the JSON:

```json
{
  "8": {
    "inputs": {
      "steps": 25,      // Increase for more detail (20-50)
      "cfg": 7.5,       // Adjust for prompt adherence (6-10)
      "denoise": 0.95   // Control how much to change (0.8-1.0)
    }
  }
}
```

## Need Help?
- Check ComfyUI console for errors
- Verify model files are correctly installed
- Try with a simpler image first
- Experiment with different prompts

Happy hat-adding! 🎩
"""
    
    with open("workflows/ADD_HAT_INSTRUCTIONS.md", 'w') as f:
        f.write(instructions)
    
    print("✓ Created ADD_HAT_INSTRUCTIONS.md")


if __name__ == "__main__":
    print("Creating 'Add Hat' workflows for Photoshop plugin...\n")
    save_workflows()
    create_usage_instructions()
    print("\n✅ All files created successfully!")
    print("\nNext steps:")
    print("1. Copy the workflow JSON files to your plugin's workflows/ directory")
    print("2. Update config.json to reference the new workflows")
    print("3. Refresh workflows in the Photoshop plugin")
    print("4. Read ADD_HAT_INSTRUCTIONS.md for usage tips")
