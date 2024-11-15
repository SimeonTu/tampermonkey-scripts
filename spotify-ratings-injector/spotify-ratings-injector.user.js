// ==UserScript==
// @name         Spotify AOTY User Ratings Injector
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Injects user ratings from Album of The Year into Spotify album pages
// @author       Simeon Tudzharov
// @match        https://open.spotify.com/album/*
// @grant        GM_xmlhttpRequest
// @connect      albumoftheyear.org
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/SimeonTu/tampermonkey-scripts/spotify-ratings-injector/spotify-ratings-injector.user.js
// @downloadURL  https://raw.githubusercontent.com/SimeonTu/tampermonkey-scripts/spotify-ratings-injector/spotify-ratings-injector.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Utility function to wait for a specific element to appear in the DOM
    function waitForElement(selector, callback, interval = 100, timeout = 10000) {
        const startTime = Date.now();
        const timer = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(timer);
                callback(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(timer);
                console.warn(`waitForElement: Timeout waiting for selector ${selector}`);
            }
        }, interval);
    }

    // Utility function to create a gradient color based on rating
    function getGradientColor(rating) {
        // Clamp rating between 0 and 100
        rating = Math.max(0, Math.min(100, rating));
        // Calculate hue: 0 (red) to 120 (green)
        const hue = (rating * 1.2);
        return `linear-gradient(90deg, hsl(${hue}, 100%, 50%), hsl(${hue}, 100%, 50%))`;
    }

    // Function to log messages with a specific prefix
    function log(message) {
        console.log(`[AOTY Injector] ${message}`);
    }

    // Function to inject CSS for pulse effect and enhanced placeholders
    function injectCSS() {
        const css = `
            @keyframes pulse {
                0% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
                100% {
                    opacity: 1;
                }
            }
            .aoty-rating {
                box-sizing: border-box;
                width: 27px; /* Fixed width */
                height: 21px; /* Fixed height */
                margin-left: 8px; /* Consistent spacing */
                border-radius: 4px;
                font-size: 0.8rem;
                color: #000; /* Black font color */
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                /* Removed padding to prevent squishing */
            }
            .aoty-placeholder {
                width: 27px; /* Match rating width */
                height: 21px; /* Match rating height */
                background-color: #ccc;
                border-radius: 4px;
                animation: pulse 1.5s infinite;
                display: inline-block;
            }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    // Function to create a placeholder element
    function createPlaceholder() {
        const placeholder = document.createElement('span');
        placeholder.className = 'aoty-placeholder';
        return placeholder;
    }

    // Function to normalize song names by removing "feat." and anything after
    function normalizeSongName(name) {
        const featRegex = /\s+(feat\.|ft\.|featuring|feat|ft)\s+.+$/i;
        return name.replace(featRegex, '').trim().toLowerCase();
    }

    // Function to inject ratings placeholders into Spotify page
    function injectRatings(ratingsMap) {
        log('Injecting ratings placeholders into Spotify page.');

        // Select all track rows
        const trackRows = document.querySelectorAll('div[data-testid="tracklist-row"]');

        if (trackRows.length === 0) {
            log('No tracks found on Spotify page.');
            return;
        }

        trackRows.forEach(row => {
            // Find the song name element
            const songLink = row.querySelector('a[data-testid="internal-track-link"] div[data-encore-id="text"]');
            if (songLink) {
                const songName = songLink.textContent.trim();
                const songNameLower = ratingsMap === null ? songName.toLowerCase() : normalizeSongName(songName);

                // Reference to the parent <a> element
                const songLinkAnchor = songLink.parentElement; // This is the <a> element

                // Ensure flex layout is applied (in case it's not already)
                songLinkAnchor.style.display = 'flex';
                songLinkAnchor.style.alignItems = 'center';

                // Check if a rating element already exists to prevent duplicates
                if (!songLinkAnchor.querySelector('.aoty-rating')) {
                    // Create the rating element
                    const ratingSpan = document.createElement('span');
                    ratingSpan.className = 'aoty-rating';

                    if (ratingsMap !== null) {
                        const rating = ratingsMap[songNameLower];
                        if (rating !== undefined && !isNaN(rating)) {
                            ratingSpan.textContent = rating;
                            ratingSpan.style.background = getGradientColor(rating);
                            ratingSpan.title = `${rating} User Score`;
                        } else {
                            ratingSpan.textContent = 'N/A';
                            ratingSpan.style.background = 'grey';
                            ratingSpan.title = 'No Ratings Available';
                        }
                    } else {
                        // Append a placeholder initially
                        const placeholder = createPlaceholder();
                        ratingSpan.appendChild(placeholder);
                    }

                    // Insert the rating next to the song name
                    songLinkAnchor.appendChild(ratingSpan);
                }
            }
        });

        log('Ratings placeholders injected.');
    }

    // Function to update placeholders with actual ratings
    function updateRatings(ratingsMap) {
        log('Updating placeholders with actual ratings.');

        // Select all rating elements
        const ratingElements = document.querySelectorAll('.aoty-rating');

        ratingElements.forEach(ratingSpan => {
            // Check if it's a placeholder
            if (ratingSpan.querySelector('.aoty-placeholder')) {
                // Find the associated song name
                const songLinkDiv = ratingSpan.parentElement.querySelector('div[data-encore-id="text"]');
                if (songLinkDiv) {
                    const songName = songLinkDiv.textContent.trim();
                    const songNameLower = normalizeSongName(songName);
                    const rating = ratingsMap ? ratingsMap[songNameLower] : null;

                    if (rating !== null && !isNaN(rating)) {
                        ratingSpan.textContent = rating;
                        ratingSpan.style.background = getGradientColor(rating);
                        ratingSpan.title = `${rating} User Score`;
                    } else if (ratingsMap !== null) { // Ratings have been fetched but no rating found
                        ratingSpan.textContent = 'N/A';
                        ratingSpan.style.background = 'grey';
                        ratingSpan.title = 'No Ratings Available';
                    } else { // Ratings are still loading or failed to fetch
                        // Optionally, keep the placeholder or set to N/A
                        ratingSpan.textContent = 'N/A';
                        ratingSpan.style.background = 'grey';
                        ratingSpan.title = 'No Ratings Available';
                    }
                }
            }
        });

        log('Ratings updated.');
    }

    // Function to observe changes in the DOM and inject ratings for new tracks
    function observeDOMChanges(ratingsMap) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Re-inject ratings for new tracks
                    injectRatings(ratingsMap);
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Main function to execute the script
    async function main() {
        log('Script started.');

        // Inject the CSS for placeholders
        injectCSS();

        // Step 1: Wait for artist name element
        waitForElement('a[data-testid="creator-link"]', async (artistElement) => {
            const artistName = artistElement.textContent.trim();
            log(`Artist Name: ${artistName}`);

            // Step 2: Wait for album name element
            waitForElement('h1[data-encore-id="text"]', async (albumElement) => {
                const albumName = albumElement.textContent.trim();
                log(`Album Name: ${albumName}`);

                // Step 3: Inject placeholders before fetching data
                injectRatings(null); // Passing null to inject placeholders immediately

                // Step 4: Construct search URL
                const query = encodeURIComponent(`${artistName} ${albumName}`);
                const searchURL = `https://www.albumoftheyear.org/search/?q=${query}`;
                log(`Constructed Search URL: ${searchURL}`);

                // Step 5: Perform search on AOTY
                GM_xmlhttpRequest({
                    method: "GET",
                    url: searchURL,
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                            "AppleWebKit/537.36 (KHTML, like Gecko) " +
                            "Chrome/115.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;" +
                            "q=0.9,image/webp,*/*;q=0.8"
                    },
                    onload: function (response) {
                        if (response.status !== 200) {
                            log(`Failed to fetch search results. Status: ${response.status}`);
                            updateRatings(null);
                            return;
                        }

                        // Parse the search results HTML
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');

                        // Find the first album result
                        const firstResult = doc.querySelector('div.image a[href^="/album/"]');
                        if (firstResult) {
                            const albumPath = firstResult.getAttribute('href');
                            const albumURL = `https://www.albumoftheyear.org${albumPath}`;
                            log(`First Album URL: ${albumURL}`);

                            // Step 6: Fetch the album page
                            GM_xmlhttpRequest({
                                method: "GET",
                                url: albumURL,
                                headers: {
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                                        "AppleWebKit/537.36 (KHTML, like Gecko) " +
                                        "Chrome/115.0.0.0 Safari/537.36",
                                    "Accept": "text/html,application/xhtml+xml,application/xml;" +
                                        "q=0.9,image/webp,*/*;q=0.8"
                                },
                                onload: function (albumResponse) {
                                    if (albumResponse.status !== 200) {
                                        log(`Failed to fetch album page. Status: ${albumResponse.status}`);
                                        updateRatings(null);
                                        return;
                                    }

                                    // Parse the album page HTML
                                    const albumDoc = parser.parseFromString(albumResponse.responseText, 'text/html');
                                    const trackRows = albumDoc.querySelectorAll('table.trackListTable tbody tr');

                                    if (trackRows.length === 0) {
                                        log('No track ratings found.');
                                        updateRatings(null);
                                        return;
                                    }

                                    // Extract song ratings
                                    const ratingsMap = {};
                                    trackRows.forEach(row => {
                                        const titleElement = row.querySelector('td.trackTitle a');
                                        const ratingElement = row.querySelector('td.trackRating span');
                                        if (titleElement && ratingElement) {
                                            const title = titleElement.textContent.trim();
                                            const ratingText = ratingElement.textContent.trim();
                                            const rating = parseInt(ratingText, 10);
                                            if (!isNaN(rating)) {
                                                ratingsMap[normalizeSongName(title)] = rating;
                                            }
                                        }
                                    });

                                    log(`Extracted Ratings: ${JSON.stringify(ratingsMap)}`);

                                    // Step 7: Update the placeholders with actual ratings
                                    updateRatings(ratingsMap);

                                    // Step 8: Start observing DOM changes for dynamic content
                                    observeDOMChanges(ratingsMap);
                                },
                                onerror: function (err) {
                                    log(`Error fetching album page: ${err}`);
                                    updateRatings(null);
                                }
                            });
                        } else {
                            log('No search results found.');
                            updateRatings(null);
                        }
                    },
                    onerror: function (err) {
                        log(`Error fetching search results: ${err}`);
                        updateRatings(null);
                    }
                });
            });
        });
    }

    // Execute the main function
    main();

})();
