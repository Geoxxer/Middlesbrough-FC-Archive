
(() => {
    "use strict";

    const CLUBS_URL = "/data/clubs.json";
    const BADGE_CLASS = "clubBadge";

    let clubsByName = new Map();
    let clubsLoaded = false;
    let observer = null;

    function normaliseName(name) {
        return String(name || "")
            .trim()
            .toLowerCase()
            .replace(/&/g, "&")
            .replace(/\s+/g, " ");
    }

    function registerClub(club) {
        if (!club || !club.name) return;

        const names = [club.name, ...(club.aliases || [])];

        for (const name of names) {
            const key = normaliseName(name);
            if (key) clubsByName.set(key, club);
        }
    }

    function findClub(name) {
        return clubsByName.get(normaliseName(name)) || null;
    }

    function addBadge(element) {
        if (!(element instanceof HTMLElement)) return;
        if (element.querySelector(".clubBadge")) return;

        const clubName = element.dataset.club;
        if (!clubName) return;

        const club = findClub(clubName);
        if (!club || !club.badge) return;

        const badge = document.createElement("img");
        badge.className = "clubBadge";
        badge.src = club.badge;
        badge.alt = "";
        badge.setAttribute("aria-hidden", "true");
        badge.draggable = false;
        badge.loading = "lazy";

        badge.addEventListener("error", () => {
            console.error(
                `[Club badges] Could not load badge for "${club.name}":`,
                club.badge
            );
            badge.remove();
        }, { once: true });

        // Place the club badge immediately after the team name.
        const nameElement = element.matches(
            ".matchTeamName, .reportTeamName"
        )
            ? element
            : element.querySelector(
                ".matchTeamName, .reportTeamName"
            );

        if (nameElement) {
            const isAway = element.closest(
                ".reportTeam--away, .matchTeam--away, " +
                ".awayTeam, [data-team-side='away']"
            );

            if (isAway) {
                nameElement.insertAdjacentElement("beforebegin", badge);
            } else {
                nameElement.insertAdjacentElement("afterend", badge);
            }
        } else {
            element.appendChild(badge);
        }
    }

    function applyClubBadges(root = document) {
        if (!clubsLoaded) return;

        if (root instanceof Element && root.matches("[data-club]")) {
            addBadge(root);
        }

        root.querySelectorAll?.("[data-club]").forEach(addBadge);
    }

    async function loadClubs() {
        try {
            const response = await fetch(CLUBS_URL);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} loading ${CLUBS_URL}`);
            }

            const data = await response.json();
            const clubs = data.clubs || {};

            clubsByName.clear();

            Object.values(clubs).forEach(registerClub);
            clubsLoaded = true;

            // Add badges to club elements already on the page.
            applyClubBadges();

            // Watch for elements inserted later by page scripts.
            if (!observer) {
                observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        mutation.addedNodes.forEach((node) => {
                            if (node instanceof Element) {
                                applyClubBadges(node);
                            }
                        });
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }

            console.info(
                `[Club badges] Loaded ${Object.keys(clubs).length} clubs.`
            );
        } catch (error) {
            console.error("[Club badges] Failed to load clubs:", error);
        }
    }

    // Allow other scripts to request another pass after rendering.
    window.applyClubBadges = applyClubBadges;
    window.findArchiveClub = findClub;

    loadClubs();
})();
