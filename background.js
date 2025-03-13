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
