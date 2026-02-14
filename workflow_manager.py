"""
ComfyUI Workflow Manager for Photoshop Plugin
This script helps manage and serve ComfyUI workflows with proper node structure
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
import base64
from io import BytesIO
from PIL import Image


class WorkflowManager:
    """Manages ComfyUI workflow templates and modifications"""
    
    def __init__(self, workflows_dir: str = "./workflows"):
        self.workflows_dir = Path(workflows_dir)
        self.workflows_dir.mkdir(exist_ok=True)
        
    def create_text2img_workflow(self) -> Dict[str, Any]:
        """Creates a basic text-to-image workflow"""
        return {
            "3": {
                "inputs": {
                    "seed": 0,
                    "steps": 20,
                    "cfg": 8,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "sd_xl_base_1.0.safetensors"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": 1024,
                    "height": 1024,
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": "",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": "",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI_PS",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        }
    
    def create_img2img_workflow(self) -> Dict[str, Any]:
        """Creates an image-to-image workflow with image input"""
        workflow = {
            "1": {
                "inputs": {
                    "image": "",
                    "upload": "image"
                },
                "class_type": "LoadImage"
            },
            "2": {
                "inputs": {
                    "pixels": ["1", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEEncode"
            },
            "3": {
                "inputs": {
                    "seed": 0,
                    "steps": 20,
                    "cfg": 7,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 0.75,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["2", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "sd_xl_base_1.0.safetensors"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "6": {
                "inputs": {
                    "text": "",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": "",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI_PS_img2img",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        }
        return workflow
    
    def create_inpaint_workflow(self) -> Dict[str, Any]:
        """Creates an inpainting workflow with image and mask inputs"""
        workflow = {
            "1": {
                "inputs": {
                    "image": "",
                    "upload": "image"
                },
                "class_type": "LoadImage"
            },
            "2": {
                "inputs": {
                    "image": "",
                    "upload": "image"
                },
                "class_type": "LoadImageMask"
            },
            "3": {
                "inputs": {
                    "grow_mask_by": 6,
                    "pixels": ["1", 0],
                    "vae": ["4", 2],
                    "mask": ["2", 0]
                },
                "class_type": "VAEEncodeForInpaint"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "sd_xl_base_1.0.safetensors"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "seed": 0,
                    "steps": 20,
                    "cfg": 8,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["3", 0]
                },
                "class_type": "KSampler"
            },
            "6": {
                "inputs": {
                    "text": "",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": "",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["5", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI_PS_inpaint",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        }
        return workflow
    
    def save_workflow(self, name: str, workflow: Dict[str, Any]):
        """Save a workflow to a JSON file"""
        filepath = self.workflows_dir / f"{name}.json"
        with open(filepath, 'w') as f:
            json.dump(workflow, f, indent=2)
        print(f"Saved workflow to {filepath}")
    
    def load_workflow(self, name: str) -> Dict[str, Any]:
        """Load a workflow from a JSON file"""
        filepath = self.workflows_dir / f"{name}.json"
        if not filepath.exists():
            raise FileNotFoundError(f"Workflow {name} not found")
        
        with open(filepath, 'r') as f:
            return json.load(f)
    
    def list_workflows(self) -> list:
        """List all available workflows"""
        return [f.stem for f in self.workflows_dir.glob("*.json")]
    
    def modify_workflow_prompts(
        self, 
        workflow: Dict[str, Any], 
        positive_prompt: str, 
        negative_prompt: str = "",
        seed: Optional[int] = None
    ) -> Dict[str, Any]:
        """Modify workflow with new prompts and optional seed"""
        import random
        
        modified = json.loads(json.dumps(workflow))  # Deep copy
        
        for node_id, node in modified.items():
            if node.get("class_type") == "CLIPTextEncode":
                # Determine if this is positive or negative based on connections
                # This is a simplification - you might need more sophisticated logic
                if not node["inputs"].get("text"):
                    node["inputs"]["text"] = positive_prompt
                else:
                    node["inputs"]["text"] = negative_prompt
            
            elif node.get("class_type") == "KSampler":
                if seed is not None:
                    node["inputs"]["seed"] = seed
                else:
                    node["inputs"]["seed"] = random.randint(0, 2**32 - 1)
        
        return modified
    
    @staticmethod
    def image_to_base64(image_path: str) -> str:
        """Convert image to base64 string"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    @staticmethod
    def base64_to_image(base64_string: str, output_path: str):
        """Convert base64 string to image file"""
        image_data = base64.b64decode(base64_string)
        image = Image.open(BytesIO(image_data))
        image.save(output_path)


def initialize_default_workflows():
    """Create and save default workflow templates"""
    manager = WorkflowManager()
    
    # Create default workflows
    workflows = {
        "text2img_workflow": manager.create_text2img_workflow(),
        "img2img_workflow": manager.create_img2img_workflow(),
        "inpaint_workflow": manager.create_inpaint_workflow(),
    }
    
    # Save them
    for name, workflow in workflows.items():
        manager.save_workflow(name, workflow)
    
    print("Default workflows created successfully!")
    print(f"Workflows saved to: {manager.workflows_dir.absolute()}")
    print(f"Available workflows: {manager.list_workflows()}")


if __name__ == "__main__":
    initialize_default_workflows()
