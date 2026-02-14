const { app, imaging } = require("photoshop");
const { batchPlay } = require("photoshop").action;

class ComfyUIPlugin {
  constructor() {
    this.serverUrl = "http://127.0.0.1:8188";
    this.selectedWorkflow = null;
    this.workflows = [];
    this.init();
  }

  init() {
    // Load saved server URL from localStorage if available
    const saved = localStorage.getItem("comfyui_server_url");
    if (saved) {
      this.serverUrl = saved;
      document.getElementById("serverUrl").value = saved;
    }

    // Event listeners
    document.getElementById("testConnection").addEventListener("click", () => this.testConnection());
    document.getElementById("refreshWorkflows").addEventListener("click", () => this.loadWorkflows());
    document.getElementById("generateBtn").addEventListener("click", () => this.generate());
    document.getElementById("serverUrl").addEventListener("change", (e) => {
      this.serverUrl = e.target.value;
      localStorage.setItem("comfyui_server_url", this.serverUrl);
    });

    // Auto-load workflows on startup
    this.loadWorkflows();
  }

  async testConnection() {
    this.showStatus("connectionStatus", "Testing connection...", "info");
    try {
      const response = await fetch(`${this.serverUrl}/system_stats`);
      if (response.ok) {
        const data = await response.json();
        this.showStatus("connectionStatus", `✓ Connected to ComfyUI (${data.system.os})`, "success");
      } else {
        throw new Error("Invalid response");
      }
    } catch (error) {
      this.showStatus("connectionStatus", `✗ Connection failed: ${error.message}`, "error");
    }
  }

  async loadWorkflows() {
    // In a real implementation, you'd load workflows from a directory
    // For now, we'll use a placeholder system
    this.workflows = [
      { name: "text2img", file: "text2img_workflow.json" },
      { name: "img2img", file: "img2img_workflow.json" },
      { name: "inpaint", file: "inpaint_workflow.json" },
      { name: "outpaint", file: "outpaint_workflow.json" }
    ];

    this.renderWorkflowList();
  }

  renderWorkflowList() {
    const container = document.getElementById("workflowList");
    container.innerHTML = "";

    this.workflows.forEach((workflow, index) => {
      const item = document.createElement("div");
      item.className = "workflow-item";
      item.textContent = workflow.name;
      item.addEventListener("click", () => {
        document.querySelectorAll(".workflow-item").forEach(i => i.classList.remove("selected"));
        item.classList.add("selected");
        this.selectedWorkflow = workflow;
      });
      container.appendChild(item);
    });
  }

  async getActiveLayerAsBase64() {
    try {
      // Get the active document
      const doc = app.activeDocument;
      
      // Create a temporary PNG file
      const tempFile = await app.createTemporaryFile("temp.png");
      
      // Export the current layer as PNG
      await doc.saveAs.png(tempFile, { compression: 9 }, true);
      
      // Read the file as base64
      const arrayBuffer = await tempFile.read({ encoding: "binary" });
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = this.arrayBufferToBase64(uint8Array);
      
      return base64;
    } catch (error) {
      console.error("Error getting layer as base64:", error);
      throw error;
    }
  }

  async getSelectionMaskAsBase64() {
    try {
      // Create a new layer filled with white
      const maskLayer = await app.activeDocument.createLayer();
      
      // Fill selection with white
      await batchPlay([
        {
          _obj: "fill",
          using: {
            _enum: "fillContents",
            _value: "white"
          },
          opacity: {
            _unit: "percentUnit",
            _value: 100
          },
          mode: {
            _enum: "blendMode",
            _value: "normal"
          }
        }
      ], {});
      
      // Get the mask as base64
      const base64 = await this.getActiveLayerAsBase64();
      
      // Delete the temporary mask layer
      await maskLayer.delete();
      
      return base64;
    } catch (error) {
      console.error("Error getting selection mask:", error);
      throw error;
    }
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async generate() {
    if (!this.selectedWorkflow) {
      this.showStatus("generationStatus", "Please select a workflow first", "error");
      return;
    }

    const prompt = document.getElementById("prompt").value;
    const negativePrompt = document.getElementById("negativePrompt").value;
    const useSelection = document.getElementById("useSelection").checked;
    const useEntireImage = document.getElementById("useEntireImage").checked;

    if (!prompt) {
      this.showStatus("generationStatus", "Please enter a prompt", "error");
      return;
    }

    try {
      this.showStatus("generationStatus", "Preparing image data...", "info");
      document.getElementById("generateBtn").disabled = true;

      let imageBase64 = null;
      let maskBase64 = null;

      // Get image if needed
      if (useEntireImage) {
        imageBase64 = await this.getActiveLayerAsBase64();
      }

      // Get selection mask if needed
      if (useSelection) {
        maskBase64 = await this.getSelectionMaskAsBase64();
      }

      // Load and modify workflow
      const workflow = await this.loadWorkflowFile(this.selectedWorkflow.file);
      const modifiedWorkflow = this.modifyWorkflow(workflow, {
        prompt,
        negativePrompt,
        image: imageBase64,
        mask: maskBase64
      });

      // Queue the prompt
      this.showStatus("generationStatus", "Sending to ComfyUI...", "info");
      const response = await fetch(`${this.serverUrl}/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: modifiedWorkflow })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const promptId = result.prompt_id;

      // Poll for completion
      this.showStatus("generationStatus", "Generating... (this may take a while)", "info");
      await this.pollForCompletion(promptId);

      // Get the result image
      const outputImage = await this.getOutputImage(promptId);

      // Import into Photoshop
      await this.importImageToPhotoshop(outputImage);

      this.showStatus("generationStatus", "✓ Generation complete!", "success");
    } catch (error) {
      this.showStatus("generationStatus", `✗ Error: ${error.message}`, "error");
      console.error("Generation error:", error);
    } finally {
      document.getElementById("generateBtn").disabled = false;
    }
  }

  async loadWorkflowFile(filename) {
    // In a real plugin, you'd load this from a bundled file or user directory
    // For now, return a template workflow
    // You'll need to replace this with actual workflow loading
    return {
      "3": {
        "inputs": {
          "seed": Math.floor(Math.random() * 1000000000),
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
          "text": "PROMPT_PLACEHOLDER",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": "NEGATIVE_PROMPT_PLACEHOLDER",
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
          "filename_prefix": "ComfyUI",
          "images": ["8", 0]
        },
        "class_type": "SaveImage"
      }
    };
  }

  modifyWorkflow(workflow, params) {
    // Clone the workflow
    const modified = JSON.parse(JSON.stringify(workflow));

    // Find and replace text prompts
    for (const nodeId in modified) {
      const node = modified[nodeId];
      
      if (node.class_type === "CLIPTextEncode") {
        if (node.inputs.text === "PROMPT_PLACEHOLDER") {
          node.inputs.text = params.prompt;
        } else if (node.inputs.text === "NEGATIVE_PROMPT_PLACEHOLDER") {
          node.inputs.text = params.negativePrompt || "";
        }
      }

      // Add image/mask loading nodes if needed
      // This would require modifying the workflow structure
      // to include LoadImage nodes with base64 data
    }

    return modified;
  }

  async pollForCompletion(promptId, maxAttempts = 300) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const response = await fetch(`${this.serverUrl}/history/${promptId}`);
        const history = await response.json();

        if (history[promptId]) {
          const status = history[promptId].status;
          if (status.completed) {
            return history[promptId];
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }

    throw new Error("Generation timed out");
  }

  async getOutputImage(promptId) {
    const response = await fetch(`${this.serverUrl}/history/${promptId}`);
    const history = await response.json();
    const outputs = history[promptId].outputs;

    // Find the SaveImage node output
    for (const nodeId in outputs) {
      const output = outputs[nodeId];
      if (output.images && output.images.length > 0) {
        const image = output.images[0];
        const imageUrl = `${this.serverUrl}/view?filename=${image.filename}&subfolder=${image.subfolder || ''}&type=${image.type}`;
        
        const imageResponse = await fetch(imageUrl);
        const blob = await imageResponse.blob();
        const arrayBuffer = await blob.arrayBuffer();
        
        return arrayBuffer;
      }
    }

    throw new Error("No output image found");
  }

  async importImageToPhotoshop(imageData) {
    // Create a temporary file
    const tempFile = await app.createTemporaryFile("output.png");
    
    // Write the image data
    await tempFile.write(imageData, { encoding: "binary" });
    
    // Open as a new layer
    await app.open(tempFile);
    
    // The image will open in a new document
    // You might want to copy it to the original document instead
  }

  showStatus(elementId, message, type) {
    const statusEl = document.getElementById(elementId);
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }
}

// Initialize the plugin
const plugin = new ComfyUIPlugin();
