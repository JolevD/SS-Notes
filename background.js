chrome.commands.onCommand.addListener((command) => {
    if (command === "capture-screenshot") {
        console.log("[Extension] Command received: capture-screenshot");

        // First, get the active tab.
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]) {
                console.error("[Extension] No active tab found.");
                return;
            }
            const tabId = tabs[0].id;
            const pageUrl = tabs[0].url;
            console.log("[Extension] Active tab URL:", pageUrl);

            // Inject a script to hide scrollbars.
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                function: hideScrollbars
            }, () => {
                console.log("[Extension] Scrollbars hidden.");

                // Wait briefly to ensure CSS is applied.
                setTimeout(() => {
                    // Capture the visible tab as a PNG.
                    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
                        if (chrome.runtime.lastError || !dataUrl) {
                            console.error("[Extension] captureVisibleTab error:", chrome.runtime.lastError);
                            chrome.notifications.create({
                                type: "basic",
                                iconUrl: "icon.png",
                                title: "Screenshot Error",
                                message: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Failed to capture screenshot.",
                                priority: 2
                            });
                            // Restore scrollbars even if there's an error.
                            chrome.scripting.executeScript({
                                target: { tabId: tabId },
                                function: showScrollbars
                            });
                            return;
                        }

                        console.log("[Extension] Screenshot captured.");

                        // Restore the scrollbars.
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            function: showScrollbars
                        }, () => {
                            console.log("[Extension] Scrollbars restored.");
                        });

                        // Immediately inject the monochrome effect.
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            function: addMonochromeEffect
                        }, () => {
                            console.log("[Extension] Monochrome effect injected.");
                        });

                        // Then, inject the input overlay for additional details.
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            function: showInputOverlay
                        }, (results) => {
                            // Check if the overlay was cancelled.
                            if (chrome.runtime.lastError || !results || results[0].result === null) {
                                console.log("[Extension] Input overlay cancelled.");
                                chrome.notifications.create({
                                    type: "basic",
                                    iconUrl: "icon.png",
                                    title: "Screenshot Cancelled",
                                    message: "Screenshot capture cancelled by the user.",
                                    priority: 2
                                });
                                return; // Abort further processing.
                            }
                            const additionalText = results[0].result;
                            console.log("[Extension] Additional text received:", additionalText);
                            processScreenshot(tabId, dataUrl, pageUrl, additionalText);
                        });
                    });
                }, 100);
            });
        });
    }
});


// ---------------------
// Injected Functions (executed in the active tab)
// ---------------------

// Hides the scrollbars by injecting a style element.
function hideScrollbars() {
    const style = document.createElement('style');
    style.id = 'hide-scrollbars-style';
    style.innerHTML = `
      ::-webkit-scrollbar { display: none !important; }
      html, body { overflow: hidden !important; }
    `;
    document.head.appendChild(style);
}

// Restores the scrollbars by removing the injected style.
function showScrollbars() {
    const style = document.getElementById('hide-scrollbars-style');
    if (style) {
        style.remove();
    }
}


// Displays a temporary monochrome overlay.
function addMonochromeEffect() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.15)';
    overlay.style.backdropFilter = 'grayscale(100%) contrast(1.1)';
    overlay.style.zIndex = '9999999';
    overlay.style.pointerEvents = 'none';
    overlay.style.transition = 'opacity 0.2s ease';

    // Add a subtle flash effect
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100vw';
    flash.style.height = '100vh';
    flash.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
    flash.style.zIndex = '9999998';
    flash.style.pointerEvents = 'none';
    flash.style.opacity = '1';
    flash.style.transition = 'opacity 0.1s ease';

    document.body.appendChild(flash);
    document.body.appendChild(overlay);

    // Animate the flash effect
    setTimeout(() => {
        flash.style.opacity = '0';
    }, 50);

    setTimeout(() => {
        flash.remove();
    }, 150);

    // Fade out the monochrome effect
    setTimeout(() => {
        overlay.style.opacity = '0';
    }, 250);

    setTimeout(() => {
        overlay.remove();
    }, 450);
}

function loadCustomFont() {
    // Get the absolute URL for your font file
    const fontUrl = chrome.runtime.getURL("fonts/MyFont.otf");
    // Create a new FontFace instance with a custom name (e.g., 'MyCustomFont')
    const font = new FontFace("MyCustomFont", `url(${fontUrl})`);
    // Load the font
    return font.load().then(loadedFont => {
        // If available, add the loaded font to the document (or self.fonts in a worker context)
        if (typeof document !== "undefined" && document.fonts) {
            document.fonts.add(loadedFont);
        } else if (self.fonts) {
            self.fonts.add(loadedFont);
        }
        console.log("[Extension] Custom font loaded");
        return loadedFont;
    });
}

// Utility: Convert a data URL to a Blob.
function dataURLToBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error("Invalid data URL");
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}
