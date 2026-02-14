/*
 * ExtendScript for Photoshop operations.
 * Called from the CEP panel via CSInterface.evalScript().
 *
 * NOTE: ExtendScript is ES3 — no let/const, no arrow functions,
 * no template literals, no promises.
 */

/**
 * Export the entire active document (flattened) as a PNG to a temp file.
 * Returns the file path string, or "ERROR:message" on failure.
 */
function exportActiveDocument() {
    try {
        var doc = app.activeDocument;
        var tempFolder = Folder.temp.fsName;
        var tempPath = tempFolder + "/comfyui_temp_export.png";
        var tempFile = new File(tempPath);

        // Duplicate and flatten so we don't modify the original
        var tempDoc = doc.duplicate("ComfyUI_Export_Temp", true);
        tempDoc.flatten();

        var opts = new PNGSaveOptions();
        opts.compression = 6;
        opts.interlaced = false;

        tempDoc.saveAs(tempFile, opts, true, Extension.LOWERCASE);
        tempDoc.close(SaveOptions.DONOTSAVECHANGES);

        // Restore focus to original document
        app.activeDocument = doc;

        return tempPath;
    } catch (e) {
        return "ERROR:" + e.message;
    }
}

/**
 * Export only the active layer as a PNG to a temp file.
 * Creates a new document with just that layer, flattens, and saves.
 * Returns the file path string, or "ERROR:message" on failure.
 */
function exportActiveLayer() {
    try {
        var doc = app.activeDocument;
        var layer = doc.activeLayer;
        var tempFolder = Folder.temp.fsName;
        var tempPath = tempFolder + "/comfyui_temp_layer.png";
        var tempFile = new File(tempPath);

        // Create a new document matching the original dimensions
        var w = doc.width.as("px");
        var h = doc.height.as("px");
        var res = doc.resolution;
        var tempDoc = app.documents.add(w, h, res, "ComfyUI_Layer_Temp",
            NewDocumentMode.RGB, DocumentFill.TRANSPARENT);

        // Duplicate the active layer into the new document
        app.activeDocument = doc;
        layer.duplicate(tempDoc, ElementPlacement.INSIDE);

        // Flatten and save
        app.activeDocument = tempDoc;
        tempDoc.flatten();

        var opts = new PNGSaveOptions();
        opts.compression = 6;
        opts.interlaced = false;

        tempDoc.saveAs(tempFile, opts, true, Extension.LOWERCASE);
        tempDoc.close(SaveOptions.DONOTSAVECHANGES);

        app.activeDocument = doc;
        return tempPath;
    } catch (e) {
        return "ERROR:" + e.message;
    }
}

/**
 * Export the current selection as a black-and-white mask PNG.
 * White = selected area, Black = unselected area.
 * Returns the file path string, or "ERROR:message" on failure.
 */
function exportSelectionMask() {
    try {
        var doc = app.activeDocument;

        // Verify there is an active selection (throws if none)
        try {
            var bounds = doc.selection.bounds;
        } catch (noSel) {
            return "ERROR:No active selection";
        }

        var tempFolder = Folder.temp.fsName;
        var tempPath = tempFolder + "/comfyui_temp_mask.png";
        var tempFile = new File(tempPath);

        // Save the selection to a temporary alpha channel
        var maskChannel = doc.channels.add();
        maskChannel.name = "ComfyUI_TempMask";
        doc.selection.store(maskChannel);

        // Duplicate the document (the channel and selection come along)
        var maskDoc = doc.duplicate("ComfyUI_Mask_Temp");
        app.activeDocument = maskDoc;
        maskDoc.flatten();

        // Fill the entire canvas with black
        maskDoc.selection.deselect();
        maskDoc.selection.selectAll();
        var black = new SolidColor();
        black.rgb.red = 0;
        black.rgb.green = 0;
        black.rgb.blue = 0;
        maskDoc.selection.fill(black);
        maskDoc.selection.deselect();

        // Load the selection from the saved channel and fill with white
        var dupChannel = maskDoc.channels["ComfyUI_TempMask"];
        maskDoc.selection.load(dupChannel);
        var white = new SolidColor();
        white.rgb.red = 255;
        white.rgb.green = 255;
        white.rgb.blue = 255;
        maskDoc.selection.fill(white);
        maskDoc.selection.deselect();

        // Remove the temporary channel from the duplicate
        dupChannel.remove();

        // Flatten and save
        maskDoc.flatten();
        var opts = new PNGSaveOptions();
        opts.compression = 6;
        opts.interlaced = false;
        maskDoc.saveAs(tempFile, opts, true, Extension.LOWERCASE);
        maskDoc.close(SaveOptions.DONOTSAVECHANGES);

        // Clean up: remove the temporary channel from the original document
        app.activeDocument = doc;
        maskChannel.remove();

        return tempPath;
    } catch (e) {
        return "ERROR:" + e.message;
    }
}

/**
 * Import an image file as a new layer in the active document.
 * @param {string} filePath - Absolute path to the image file.
 * Returns "OK" on success or "ERROR:message" on failure.
 */
function importImageAsLayer(filePath) {
    try {
        var doc = app.activeDocument;
        var file = new File(filePath);

        if (!file.exists) {
            return "ERROR:File not found: " + filePath;
        }

        // Open the image in a temporary document
        var importedDoc = app.open(file);

        // Select all and copy
        importedDoc.selection.selectAll();
        importedDoc.activeLayer.copy();
        importedDoc.close(SaveOptions.DONOTSAVECHANGES);

        // Paste into the original document as a new layer
        app.activeDocument = doc;
        doc.paste();
        doc.activeLayer.name = "ComfyUI_Generated";

        return "OK";
    } catch (e) {
        return "ERROR:" + e.message;
    }
}

/**
 * Get basic info about the active document.
 * Returns a JSON string with width, height, resolution, name.
 */
function getDocumentInfo() {
    try {
        var doc = app.activeDocument;
        var info = {
            name: doc.name,
            width: doc.width.as("px"),
            height: doc.height.as("px"),
            resolution: doc.resolution,
            mode: String(doc.mode),
            layerCount: doc.layers.length
        };
        return JSON.stringify(info);
    } catch (e) {
        return "ERROR:" + e.message;
    }
}
