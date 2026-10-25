
(() => {
    "use strict";

    const FLAGS_DIRECTORY = "/data/custom_flags/";
    const FLAG_CLASS = "customFlag";

    function isAway(element) {
        return Boolean(element.closest(
            ".reportTeam--away, .matchTeam--away, " +
            ".awayTeam, [data-team-side='away']"
        ));
    }

    function addFlag(element) {
        if (!(element instanceof HTMLElement)) return;

        if (element.querySelector(`.${FLAG_CLASS}`)) return;

        const code = String(element.dataset.flag || "")
            .trim()
            .toLowerCase();

        if (!/^[a-z0-9_-]{2,3}$/.test(code)) return;

        const flag = document.createElement("img");
        flag.className = FLAG_CLASS;
        flag.src = `${FLAGS_DIRECTORY}${code}.svg`;
        flag.alt = "";
        flag.setAttribute("aria-hidden", "true");
        flag.draggable = false;
        flag.loading = "lazy";

        flag.addEventListener("error", () => {
            console.error(
                `[Custom flags] Could not load flag: ${flag.src}`
            );
            flag.remove();
        }, { once: true });

        if (isAway(element)) {
            element.appendChild(flag);
        } else {
            element.prepend(flag);
        }
    }

    function applyCustomFlags(root = document) {
        if (
            root instanceof Element &&
            root.matches("[data-flag]")
        ) {
            addFlag(root);
        }

        root.querySelectorAll?.("[data-flag]").forEach(addFlag);
    }

    window.applyCustomFlags = applyCustomFlags;

    applyCustomFlags();

    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                    applyCustomFlags(node);
                }
            }
        }
    });

    function startObserver() {
        if (!document.body) return;

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        applyCustomFlags();
    }

    if (document.body) {
        startObserver();
    } else {
        document.addEventListener(
            "DOMContentLoaded",
            startObserver,
            { once: true }
        );
    }
})();
