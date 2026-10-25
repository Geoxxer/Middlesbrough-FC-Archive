(() => {
    "use strict";

    const CONTAINER_ID = "matchList";
    const SEASON_PATTERN = /^\d{4}-\d{2}$/;

    const container = document.getElementById(CONTAINER_ID);

    if (!container) {
        console.error(
            `[Season matches] Could not find #${CONTAINER_ID}.`
        );
        return;
    }

    /*
     * Works out which season this page is showing.
     *
     * 1. An explicit override on the container wins:
     *      <div id="matchList" data-season="2026-27">
     * 2. Otherwise it is read from the page URL, so these all work:
     *      /2026-27.html    /2026-27    /seasons/2026-27/
     *
     * Returns something like "2026-27", or null if it can't tell.
     */
    function getSeason() {
        const fromAttribute = (container.dataset.season || "").trim();

        if (SEASON_PATTERN.test(fromAttribute)) {
            return fromAttribute;
        }

        const fromPath = location.pathname.match(
            /(?:^|\/)(\d{4}-\d{2})(?:\.html)?\/?$/
        );

        return fromPath ? fromPath[1] : null;
    }

    const SEASON = getSeason();
    const MATCHES_URL = SEASON ? `/data/matches/${SEASON}.json` : "";

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function getTeamName(team) {
        if (typeof team === "string") return team;
        return team?.name || "Unknown team";
    }

    function getScore(match) {
        const score = match.score;

        if (score && typeof score === "object") {
            const home = score.home ?? score.homeScore;
            const away = score.away ?? score.awayScore;

            if (home != null && away != null) {
                return `${home}–${away}`;
            }
        }

        if (typeof score === "string" && score.trim()) {
            return score.trim().replace(/-/g, "–");
        }

        // No score recorded (match not played yet).
        return null;
    }

    function getDate(match) {
        if (!match.date) return "";

        const date = new Date(`${match.date}T12:00:00`);

        if (Number.isNaN(date.getTime())) {
            return match.date;
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function getType(match) {
        const type = String(match.type || "competitive").toLowerCase();

        return type === "friendly" || type === "friendlies"
            ? "friendly"
            : "competitive";
    }


    function getRoundLabel(match) {
        if (match.round == null || match.round === "") return "";

        const round = String(match.round).trim();
        const competition = String(match.competition || "").toLowerCase();

        if (
            competition.includes("premier league") ||
            competition.includes("premiership") ||
            competition.includes("championship") ||
            competition.includes("league one") ||
            competition.includes("league two")
        ) {
            return /^matchweek\b/i.test(round)
                ? round
                : `Matchweek ${round}`;
        }

        // Preserve named cup and play-off rounds, including leg information.
        if (
            /^(?:round of \d+|semi[- ]final|quarter[- ]final|final|play[- ]offs?)(?:\b.*)?$/i.test(round) ||
            /^(?:first|second|1st|2nd) leg$/i.test(round) ||
            /^round\s+(?:of \d+|semi[- ]final|quarter[- ]final|final)\b/i.test(round)
        ) {
            return round;
        }

        return /^round\b/i.test(round)
            ? round
            : `Round ${round}`;
    }


    function makeTeam(team, side) {
        const name = getTeamName(team);

        // Preserve an optional flag code if the match data supplies one.
        const flagCode = typeof team === "object" && team
            ? team.flag ?? team.flagCode ?? team.countryCode
            : "";

        const flagAttribute = /^[a-z0-9_-]{2,3}$/i.test(
            String(flagCode || "")
        )
            ? ` data-flag="${escapeHTML(flagCode)}"`
            : "";

        return `
            <span
                class="matchTeam matchTeam--${side}"
                data-team-side="${side}"
                data-club="${escapeHTML(name)}"${flagAttribute}
            ><span class="matchTeamName">${escapeHTML(name)}</span></span>
        `;
    }

    function makeMatchRow(match) {
        const homeName = getTeamName(match.home);
        const awayName = getTeamName(match.away);
        const score = getScore(match); // null when there is no score yet

        // The season is passed along so report.html can load the right file.
        const reportUrl =
            `report.html?id=${encodeURIComponent(match.id)}` +
            `&season=${encodeURIComponent(SEASON)}`;

        const date = getDate(match);
        const kickoff = match.kickoff || "";

        // No score yet: show the kick-off time in the centre instead of "v"
        // (falls back to "v" if there is no kick-off time either).
        const isUnplayed = score === null;
        const centreText = isUnplayed ? (kickoff || "v") : score;
        const kickoffInCentre = isUnplayed && Boolean(kickoff);
        const competition = match.competition || "";
        const round = getRoundLabel(match);

        const fixtureContent = `
            ${makeTeam(match.home, "home")}
            <span class="matchResult">
                <span class="matchScore${kickoffInCentre ? " matchScore--kickoff" : ""}">${escapeHTML(centreText)}</span>
            </span>
            ${makeTeam(match.away, "away")}
        `;

        const row = document.createElement("article");
        row.className = "matchRow";
        row.dataset.matchId = match.id || "";
        row.dataset.matchType = getType(match);

        row.innerHTML = `
            <a
                href="${escapeHTML(reportUrl)}"
                class="matchReportLink"
                aria-label="Read match report: ${escapeHTML(homeName)} ${escapeHTML(isUnplayed ? "v" : score)} ${escapeHTML(awayName)}"
            >
                <div class="matchMeta">
                    ${competition
                        ? `<span class="matchCompetition">${escapeHTML(competition)}</span>`
                        : ""}
                    ${round
                        ? `<span class="matchRound">${escapeHTML(round)}</span>`
                        : ""}
                    ${date
                        ? `<time class="matchDate" datetime="${escapeHTML(match.date || "")}">${escapeHTML(date)}</time>`
                        : ""}
                    ${kickoff && !kickoffInCentre
                        ? `<span class="matchKickoff">${escapeHTML(kickoff)}</span>`
                        : ""}
                </div>

                <div class="matchFixture matchFixture--link">
                    ${fixtureContent}
                </div>
            </a>
        `;

        return row;
    }

    function makeSection(title, matches, sectionClass) {
        const section = document.createElement("section");
        section.className = `matchSection ${sectionClass}`;

        const heading = document.createElement("h3");
        heading.className = "matchSectionTitle";
        heading.textContent = title;

        section.appendChild(heading);

        if (matches.length === 0) {
            const empty = document.createElement("p");
            empty.className = "matchEmpty";
            empty.textContent = "No matches recorded.";
            section.appendChild(empty);
            return section;
        }

        for (const match of matches) {
            section.appendChild(makeMatchRow(match));
        }

        return section;
    }

    function renderMatches(data) {
        if (!Array.isArray(data.matches)) {
            throw new Error(
                'The JSON file must contain a "matches" array.'
            );
        }

        const matches = [...data.matches].sort((a, b) =>
            String(a.date || "").localeCompare(String(b.date || ""))
        );

        const friendlies = matches.filter(
            match => getType(match) === "friendly"
        );

        const competitive = matches.filter(
            match => getType(match) === "competitive"
        );

        // Identify play-off matches from their competition or round labels.
        const isPlayOff = match => {
            const competition = String(match.competition || "");
            const round = String(match.round || "");

            return /play[\s-]*offs?/i.test(competition) ||
                /play[\s-]*offs?/i.test(round);
        };

        const playOffs = competitive.filter(isPlayOff);

        const otherCompetitive = competitive.filter(
            match => !isPlayOff(match)
        );

        const fragment = document.createDocumentFragment();

        // 1. Friendlies first.
        if (friendlies.length > 0) {
            fragment.appendChild(
                makeSection(
                    "Friendlies",
                    friendlies,
                    "matchGroup matchGroup--friendlies"
                )
            );
        }

        // 2. Other competitive matches.
        if (otherCompetitive.length > 0) {
            const competitiveSection = document.createElement("section");
            competitiveSection.className =
                "matchGroup matchGroup--competitive";

            for (const match of otherCompetitive) {
                competitiveSection.appendChild(makeMatchRow(match));
            }

            fragment.appendChild(competitiveSection);
        }

        // 3. Play-off campaign, only when play-off matches exist.
        if (playOffs.length > 0) {
            fragment.appendChild(
                makeSection(
                    "Play-Offs",
                    playOffs,
                    "matchGroup matchGroup--playoffs"
                )
            );
        }

        container.replaceChildren(fragment);

        // Apply club badges and custom country flags to inserted rows.
        if (typeof window.applyClubBadges === "function") {
            window.applyClubBadges(container);
        }

        if (typeof window.applyCustomFlags === "function") {
            window.applyCustomFlags(container);
        }
    }

    function showMessage(className, text) {
        const message = document.createElement("p");
        message.className = className;
        message.textContent = text;
        container.replaceChildren(message);
    }

    async function loadMatches() {
        if (!SEASON) {
            console.error(
                "[Season matches] Could not work out the season. " +
                'Name the page like "2026-27.html" or add ' +
                `data-season="2026-27" to #${CONTAINER_ID}.`
            );
            showMessage(
                "matchError",
                "Match information could not be loaded."
            );
            return;
        }

        try {
            const response = await fetch(MATCHES_URL);

            if (response.status === 404) {
                console.error(
                    `[Season matches] ${MATCHES_URL} does not exist.`
                );
                showMessage(
                    "matchEmpty",
                    `No matches have been added for ${SEASON} yet.`
                );
                return;
            }

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status} loading ${MATCHES_URL}`
                );
            }

            renderMatches(await response.json());
        } catch (error) {
            console.error(
                "[Season matches] Failed to load matches:",
                error
            );

            showMessage(
                "matchError",
                "Match information could not be loaded."
            );
        }
    }

    loadMatches();
})();