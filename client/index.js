/* global CSInterface, SystemPath */

// Node.js modules — wrapped in try-catch so the script still runs
// even when the CEP runtime has Node.js disabled.
var fs, path, os, http;
var _nodeAvailable = false;
try {
    fs = require("fs");
    path = require("path");
    os = require("os");
    http = require("http");
    _nodeAvailable = true;
} catch (e) {
    console.warn("[ComfyUI] Node.js require failed:", e.message);
}

var csInterface;
try {
    csInterface = new CSInterface();
} catch (e) {
    console.error("[ComfyUI] CSInterface init failed:", e.message);
}

var ComfyUIPlugin = (function() {
    "use strict";

    var serverUrl = "http://127.0.0.1:8188";
    var selectedWorkflow = null;
    var workflows = [];
    var extensionPath = "";
    try {
        if (csInterface) extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    } catch (e) { /* ignore */ }

    function init() {
        // Load saved server URL
        var saved = localStorage.getItem("comfyui_server_url");
        if (saved) {
            serverUrl = saved;
            document.getElementById("serverUrl").value = saved;
        }

        // Event listeners
        document.getElementById("testConnection").addEventListener("click", testConnection);
        document.getElementById("refreshWorkflows").addEventListener("click", loadWorkflows);
        document.getElementById("generateBtn").addEventListener("click", generate);
        document.getElementById("serverUrl").addEventListener("change", function(e) {
            serverUrl = e.target.value;
            localStorage.setItem("comfyui_server_url", serverUrl);
        });

        // Auto-load workflows
        loadWorkflows();

        // Startup diagnostic — confirms JS actually executed
        showStatus("connectionStatus",
            "Plugin loaded (Node.js: " + (_nodeAvailable ? "available" : "unavailable") + ")", "info");
    }

    // --- Status display ---

    function showStatus(elementId, message, type) {
        var el = document.getElementById(elementId);
        el.textContent = message;
        el.className = "status " + type;
    }

    // --- ComfyUI HTTP communication ---

    // Node.js http GET — bypasses CORS entirely
    function nodeHttpGet(url) {
        return new Promise(function(resolve, reject) {
            var parsed = new (require("url").URL)(url);
            var opts = { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: "GET" };
            var req = http.request(opts, function(res) {
                var chunks = [];
                res.on("data", function(c) { chunks.push(c); });
                res.on("end", function() {
                    var body = chunks.join("");
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        reject(new Error("HTTP " + res.statusCode));
                    } else {
                        resolve(JSON.parse(body));
                    }
                });
            });
            req.on("error", reject);
            req.end();
        });
    }

    function testConnection() {
        showStatus("connectionStatus", "Testing connection...", "info");

        var promise;
        if (_nodeAvailable && http) {
            // Prefer Node.js http — no CORS restrictions
            promise = nodeHttpGet(serverUrl + "/system_stats");
        } else {
            // Fallback to browser fetch
            promise = fetch(serverUrl + "/system_stats")
                .then(function(r) {
                    if (!r.ok) throw new Error("HTTP " + r.status);
                    return r.json();
                });
        }

        promise
            .then(function(data) {
                showStatus("connectionStatus", "Connected to ComfyUI (" + data.system.os + ")", "success");
            })
            .catch(function(err) {
                showStatus("connectionStatus", "Connection failed: " + err.message, "error");
            });
    }

    function loadWorkflows() {
        workflows = [];

        if (!_nodeAvailable) {
            showStatus("generationStatus",
                "Node.js unavailable — cannot read workflow files", "error");
            renderWorkflowList();
            return;
        }

        var workflowDir = path.join(extensionPath, "workflows");
        try {
            var files = fs.readdirSync(workflowDir);
            files.forEach(function(file) {
                if (/\.json$/i.test(file)) {
                    workflows.push({
                        name: file.replace(/\.json$/i, ""),
                        file: file,
                        path: path.join(workflowDir, file)
                    });
                }
            });
        } catch (e) {
            console.error("[ComfyUI] Failed to read workflows dir:", e.message);
        }

        if (workflows.length === 0) {
            showStatus("generationStatus",
                "No workflows found. In ComfyUI, use Save (API Format) and place .json files in:\n" + workflowDir,
                "info");
        }

        renderWorkflowList();
    }

    function renderWorkflowList() {
        var container = document.getElementById("workflowList");
        container.innerHTML = "";
        workflows.forEach(function(workflow) {
            var item = document.createElement("div");
            item.className = "workflow-item";
            item.textContent = workflow.name;
            item.addEventListener("click", function() {
                document.querySelectorAll(".workflow-item").forEach(function(i) {
                    i.classList.remove("selected");
                });
                item.classList.add("selected");
                selectedWorkflow = workflow;
            });
            container.appendChild(item);
        });
    }

    // --- Photoshop operations via ExtendScript ---

    function evalScript(script) {
        return new Promise(function(resolve, reject) {
            csInterface.evalScript(script, function(result) {
                if (result && result.indexOf("ERROR:") === 0) {
                    reject(new Error(result.substring(6)));
                } else if (result === "EvalScript Error") {
                    reject(new Error("ExtendScript evaluation failed"));
                } else {
                    resolve(result);
                }
            });
        });
    }

    function exportActiveDocument() {
        return evalScript("exportActiveDocument()");
    }

    function exportSelectionMask() {
        return evalScript("exportSelectionMask()");
    }

    function importImageAsLayer(filePath) {
        // Escape backslashes for ExtendScript string
        var escaped = filePath.replace(/\\/g, "\\\\");
        return evalScript('importImageAsLayer("' + escaped + '")');
    }

    // --- ComfyUI image upload ---

    function uploadImageToComfyUI(filePath, filename) {
        return new Promise(function(resolve, reject) {
            var buffer = fs.readFileSync(filePath);
            var blob = new Blob([new Uint8Array(buffer)], { type: "image/png" });

            var formData = new FormData();
            formData.append("image", blob, filename || "comfyui_input.png");
            formData.append("overwrite", "true");

            fetch(serverUrl + "/upload/image", {
                method: "POST",
                body: formData
            })
            .then(function(r) {
                if (!r.ok) throw new Error("Upload failed: " + r.status);
                return r.json();
            })
            .then(function(data) {
                resolve(data.name);
            })
            .catch(reject);
        });
    }

    // --- Combine image + mask into a single PNG with alpha ---
    // ComfyUI's LoadImage extracts the mask from the alpha channel:
    //   opaque (alpha=255) → mask=0 → KEEP
    //   transparent (alpha=0) → mask=1 → INPAINT
    // The selection mask from Photoshop is: white=selected=inpaint, black=keep.
    // So: alpha = 255 - maskPixel.

    function combineImageAndMask(imagePath, maskPath) {
        return new Promise(function(resolve, reject) {
            var imgBuf = fs.readFileSync(imagePath);
            var maskBuf = fs.readFileSync(maskPath);

            var imgDataUrl = "data:image/png;base64," + imgBuf.toString("base64");
            var maskDataUrl = "data:image/png;base64," + maskBuf.toString("base64");

            var img = new Image();
            var maskImg = new Image();
            var loaded = 0;

            function onBothLoaded() {
                var canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext("2d");

                // Draw the full RGB image
                ctx.drawImage(img, 0, 0);
                var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Draw mask scaled to the same dimensions
                var mc = document.createElement("canvas");
                mc.width = canvas.width;
                mc.height = canvas.height;
                var mctx = mc.getContext("2d");
                mctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
                var maskData = mctx.getImageData(0, 0, canvas.width, canvas.height);

                // Bake mask into alpha: white(255) in mask → alpha=0, black(0) → alpha=255
                var px = imageData.data;
                var mx = maskData.data;
                for (var i = 0; i < px.length; i += 4) {
                    px[i + 3] = 255 - mx[i]; // R channel of mask → inverted alpha
                }
                ctx.putImageData(imageData, 0, 0);

                // Export to PNG file
                var dataUrl = canvas.toDataURL("image/png");
                var base64 = dataUrl.split(",")[1];
                var outPath = path.join(os.tmpdir(), "comfyui_combined_" + Date.now() + ".png");
                fs.writeFileSync(outPath, Buffer.from(base64, "base64"));
                resolve(outPath);
            }

            function onLoad() { loaded++; if (loaded === 2) onBothLoaded(); }
            img.onload = onLoad;
            maskImg.onload = onLoad;
            img.onerror = function() { reject(new Error("Failed to load image")); };
            maskImg.onerror = function() { reject(new Error("Failed to load mask")); };
            img.src = imgDataUrl;
            maskImg.src = maskDataUrl;
        });
    }

    // --- Workflow file loading ---

    function loadWorkflowFile(workflow) {
        var content = fs.readFileSync(workflow.path, "utf8");
        return JSON.parse(content);
    }

    function modifyWorkflow(workflow, params) {
        var modified = JSON.parse(JSON.stringify(workflow));

        // ── 1. Randomize seeds in ALL nodes (universal) ──
        // Catches KSampler, KSamplerAdvanced, SamplerCustom, RandomNoise,
        // and any custom node that has a numeric seed/noise_seed input.
        for (var sId in modified) {
            var sn = modified[sId];
            if (!sn.inputs) continue;
            if (typeof sn.inputs.seed === "number") {
                sn.inputs.seed = Math.floor(Math.random() * 1000000000);
            }
            if (typeof sn.inputs.noise_seed === "number") {
                sn.inputs.noise_seed = Math.floor(Math.random() * 1000000000);
            }
        }

        // ── 2. Trace conditioning connections from sampler nodes ──
        // Detect any node with both "positive" and "negative" array (connection)
        // inputs — covers KSampler, KSamplerAdvanced, SamplerCustom, and any
        // custom sampler node that follows the same wiring convention.
        var positiveNodeIds = {};
        var negativeNodeIds = {};

        for (var cId in modified) {
            var cn = modified[cId];
            if (!cn.inputs) continue;
            if (Array.isArray(cn.inputs.positive) && Array.isArray(cn.inputs.negative)) {
                positiveNodeIds[cn.inputs.positive[0]] = true;
                negativeNodeIds[cn.inputs.negative[0]] = true;
            }
        }

        // ── 3. Inject prompts ──
        var positiveInjected = false;
        var negativeInjected = false;

        // Priority A — nodes wired to sampler positive/negative (most reliable)
        // Check common prompt input names: "text" (CLIPTextEncode), "prompt"
        // (TextEncodeQwenImageEditPlus, etc.), "caption", "positive_prompt"
        var PROMPT_INPUT_NAMES = ["text", "prompt", "caption", "positive_prompt", "text_positive"];
        for (var pId in modified) {
            var pn = modified[pId];
            if (!pn.inputs) continue;
            if (positiveNodeIds[pId] && params.prompt && !positiveInjected) {
                for (var pk = 0; pk < PROMPT_INPUT_NAMES.length; pk++) {
                    if (typeof pn.inputs[PROMPT_INPUT_NAMES[pk]] === "string") {
                        pn.inputs[PROMPT_INPUT_NAMES[pk]] = params.prompt;
                        positiveInjected = true;
                        break;
                    }
                }
            }
            if (negativeNodeIds[pId] && !negativeInjected) {
                for (var nk = 0; nk < PROMPT_INPUT_NAMES.length; nk++) {
                    if (typeof pn.inputs[PROMPT_INPUT_NAMES[nk]] === "string") {
                        pn.inputs[PROMPT_INPUT_NAMES[nk]] = params.negativePrompt || "";
                        negativeInjected = true;
                        break;
                    }
                }
            }
        }

        // Priority B — input-name heuristic for non-standard / custom nodes
        // (only runs if connection tracing found nothing)
        if (!positiveInjected && params.prompt) {
            var POS_NAMES = ["prompt", "positive_prompt", "text_positive", "text", "caption"];
            for (var hId in modified) {
                if (positiveInjected) break;
                var hn = modified[hId];
                if (!hn.inputs) continue;
                for (var pi = 0; pi < POS_NAMES.length; pi++) {
                    if (typeof hn.inputs[POS_NAMES[pi]] === "string") {
                        hn.inputs[POS_NAMES[pi]] = params.prompt;
                        positiveInjected = true;
                        break;
                    }
                }
            }
        }

        if (!negativeInjected && params.negativePrompt) {
            var NEG_NAMES = ["negative_prompt", "text_negative"];
            for (var nId in modified) {
                if (negativeInjected) break;
                var nn = modified[nId];
                if (!nn.inputs) continue;
                for (var ni = 0; ni < NEG_NAMES.length; ni++) {
                    if (typeof nn.inputs[NEG_NAMES[ni]] === "string") {
                        nn.inputs[NEG_NAMES[ni]] = params.negativePrompt || "";
                        negativeInjected = true;
                        break;
                    }
                }
            }
        }

        // ── 4. Inject images and masks ──
        for (var iId in modified) {
            var imn = modified[iId];
            if (!imn.inputs) continue;
            var ct = imn.class_type || "";

            // Image loading nodes (class_type starts with "Load" and contains
            // "Image" but not "Mask")
            var isImageLoader = ct === "LoadImage" ||
                (ct.indexOf("Load") === 0 && ct.indexOf("Image") !== -1 && ct.indexOf("Mask") === -1);
            if (isImageLoader && params.imageName && typeof imn.inputs.image === "string") {
                imn.inputs.image = params.imageName;
            }

            // Mask loading nodes (class_type starts with "Load" and contains "Mask")
            var isMaskLoader = ct === "LoadImageMask" ||
                (ct.indexOf("Load") === 0 && ct.indexOf("Mask") !== -1);
            if (isMaskLoader && params.maskName && typeof imn.inputs.image === "string") {
                imn.inputs.image = params.maskName;
            }
        }

        return modified;
    }

    // --- Polling and result retrieval ---

    function pollForCompletion(promptId, maxAttempts) {
        maxAttempts = maxAttempts || 300;
        var attempt = 0;

        return new Promise(function(resolve, reject) {
            function poll() {
                if (attempt >= maxAttempts) {
                    reject(new Error("Generation timed out"));
                    return;
                }
                attempt++;
                fetch(serverUrl + "/history/" + promptId)
                    .then(function(r) { return r.json(); })
                    .then(function(history) {
                        if (history[promptId] && history[promptId].status && history[promptId].status.completed) {
                            resolve(history[promptId]);
                        } else {
                            setTimeout(poll, 1000);
                        }
                    })
                    .catch(function() {
                        setTimeout(poll, 1000);
                    });
            }
            poll();
        });
    }

    function getOutputImage(promptId) {
        return fetch(serverUrl + "/history/" + promptId)
            .then(function(r) { return r.json(); })
            .then(function(history) {
                var outputs = history[promptId].outputs;
                for (var nodeId in outputs) {
                    var output = outputs[nodeId];
                    if (output.images && output.images.length > 0) {
                        var image = output.images[0];
                        var imageUrl = serverUrl + "/view?filename=" +
                            encodeURIComponent(image.filename) +
                            "&subfolder=" + encodeURIComponent(image.subfolder || "") +
                            "&type=" + encodeURIComponent(image.type);
                        return fetch(imageUrl);
                    }
                }
                throw new Error("No output image found");
            })
            .then(function(r) { return r.arrayBuffer(); });
    }

    // --- Main generation flow ---

    function generate() {
        if (!selectedWorkflow) {
            showStatus("generationStatus", "Please select a workflow first", "error");
            return;
        }

        var promptText = document.getElementById("prompt").value;
        var negativePrompt = document.getElementById("negativePrompt").value;
        var useSelection = document.getElementById("useSelection").checked;
        var useEntireImage = document.getElementById("useEntireImage").checked;

        if (!promptText) {
            showStatus("generationStatus", "Please enter a prompt", "error");
            return;
        }

        var generateBtn = document.getElementById("generateBtn");
        generateBtn.disabled = true;
        showStatus("generationStatus", "Preparing...", "info");

        var imageName = null;
        var maskName = null;

        // Step 1: Export image and/or mask from Photoshop
        var exportPromise = Promise.resolve();

        if (useEntireImage && useSelection) {
            // Inpaint mode: combine image + selection into a single PNG with alpha.
            // LoadImage nodes will extract both the RGB image and the mask from alpha.
            showStatus("generationStatus", "Exporting image + mask from Photoshop...", "info");
            var rawImagePath, rawMaskPath;
            exportPromise = exportActiveDocument()
                .then(function(imgPath) { rawImagePath = imgPath; return exportSelectionMask(); })
                .then(function(mskPath) { rawMaskPath = mskPath; return combineImageAndMask(rawImagePath, rawMaskPath); })
                .then(function(combinedPath) { return uploadImageToComfyUI(combinedPath, "comfyui_input.png"); })
                .then(function(name) {
                    imageName = name;
                    // Also upload the raw mask for workflows using LoadImageMask
                    return uploadImageToComfyUI(rawMaskPath, "comfyui_mask.png");
                })
                .then(function(name) { maskName = name; });
        } else if (useEntireImage) {
            showStatus("generationStatus", "Exporting image from Photoshop...", "info");
            exportPromise = exportActiveDocument()
                .then(function(filePath) { return uploadImageToComfyUI(filePath, "comfyui_input.png"); })
                .then(function(name) { imageName = name; });
        } else if (useSelection) {
            showStatus("generationStatus", "Exporting selection mask...", "info");
            exportPromise = exportSelectionMask()
                .then(function(filePath) { return uploadImageToComfyUI(filePath, "comfyui_mask.png"); })
                .then(function(name) { maskName = name; });
        }

        exportPromise
            .then(function() {
                // Step 2: Load workflow file and send to ComfyUI
                showStatus("generationStatus", "Sending to ComfyUI...", "info");
                var workflow = loadWorkflowFile(selectedWorkflow);
                var modified = modifyWorkflow(workflow, {
                    prompt: promptText,
                    negativePrompt: negativePrompt,
                    imageName: imageName,
                    maskName: maskName
                });

                return fetch(serverUrl + "/prompt", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: modified })
                });
            })
            .then(function(r) {
                if (!r.ok) throw new Error("HTTP error: " + r.status);
                return r.json();
            })
            .then(function(result) {
                // Step 3: Poll for completion
                showStatus("generationStatus", "Generating... (this may take a while)", "info");
                return pollForCompletion(result.prompt_id);
            })
            .then(function(historyEntry) {
                // Step 4: Download result image
                showStatus("generationStatus", "Downloading result...", "info");
                var outputs = historyEntry.outputs;
                for (var nodeId in outputs) {
                    var output = outputs[nodeId];
                    if (output.images && output.images.length > 0) {
                        var image = output.images[0];
                        var imageUrl = serverUrl + "/view?filename=" +
                            encodeURIComponent(image.filename) +
                            "&subfolder=" + encodeURIComponent(image.subfolder || "") +
                            "&type=" + encodeURIComponent(image.type);
                        return fetch(imageUrl).then(function(r) { return r.arrayBuffer(); });
                    }
                }
                throw new Error("No output image found");
            })
            .then(function(imageBuffer) {
                // Step 5: Save to temp file and import into Photoshop
                showStatus("generationStatus", "Importing into Photoshop...", "info");
                var tempPath = path.join(os.tmpdir(), "comfyui_output_" + Date.now() + ".png");
                fs.writeFileSync(tempPath, Buffer.from(imageBuffer));
                return importImageAsLayer(tempPath);
            })
            .then(function() {
                showStatus("generationStatus", "Generation complete!", "success");
            })
            .catch(function(err) {
                showStatus("generationStatus", "Error: " + err.message, "error");
                console.error("Generation error:", err);
            })
            .then(function() {
                generateBtn.disabled = false;
            });
    }

    // --- Initialize on DOM ready ---
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    return {
        testConnection: testConnection,
        loadWorkflows: loadWorkflows,
        generate: generate
    };
})();
