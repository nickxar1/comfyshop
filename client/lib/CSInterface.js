/**
 * CSInterface - Adobe CEP (Common Extension Platform) interface library.
 * Provides communication between the HTML panel and the host application (Photoshop).
 * Minimal version covering the APIs needed by this extension.
 */

var SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};

var CSEvent = function() {
    this.type = "";
    this.scope = "APPLICATION";
    this.appId = "";
    this.extensionId = "";
    this.data = "";
};

function CSInterface() {
    this._hostEnvironment = null;
}

/**
 * Evaluate ExtendScript in the host application.
 * @param {string} script - The ExtendScript code to evaluate.
 * @param {function} callback - Callback receiving the result string.
 */
CSInterface.prototype.evalScript = function(script, callback) {
    if (callback === null || callback === undefined) {
        callback = function() {};
    }
    if (window.__adobe_cep__) {
        window.__adobe_cep__.evalScript(script, callback);
    } else {
        console.warn("CSInterface: __adobe_cep__ not available (not running inside CEP)");
        callback("EvalScript Error");
    }
};

/**
 * Get a system or extension path.
 * @param {string} pathType - One of the SystemPath constants.
 * @returns {string} The resolved path.
 */
CSInterface.prototype.getSystemPath = function(pathType) {
    if (!window.__adobe_cep__) return "";
    var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
    if (navigator.platform.indexOf("Win") >= 0) {
        path = path.replace("file:///", "");
    } else {
        path = path.replace("file://", "");
    }
    return path;
};

/**
 * Get host environment information.
 * @returns {object} Host environment details (appName, appVersion, etc.)
 */
CSInterface.prototype.getHostEnvironment = function() {
    if (!this._hostEnvironment && window.__adobe_cep__) {
        this._hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());
    }
    return this._hostEnvironment;
};

/**
 * Register an event listener for CEP events.
 * @param {string} type - Event type string.
 * @param {function} listener - The listener function.
 */
CSInterface.prototype.addEventListener = function(type, listener) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener);
    }
};

/**
 * Remove an event listener.
 * @param {string} type - Event type string.
 * @param {function} listener - The listener function to remove.
 */
CSInterface.prototype.removeEventListener = function(type, listener) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.removeEventListener(type, listener);
    }
};

/**
 * Dispatch a CEP event.
 * @param {CSEvent} event - The event to dispatch.
 */
CSInterface.prototype.dispatchEvent = function(event) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.dispatchEvent(event);
    }
};

/**
 * Open a URL in the default system browser.
 * @param {string} url - The URL to open.
 */
CSInterface.prototype.openURLInDefaultBrowser = function(url) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.openURLInDefaultBrowser(url);
    }
};

/**
 * Get the extension ID.
 * @returns {string} The extension ID from the manifest.
 */
CSInterface.prototype.getExtensionID = function() {
    if (window.__adobe_cep__) {
        return window.__adobe_cep__.getExtensionId();
    }
    return "";
};
