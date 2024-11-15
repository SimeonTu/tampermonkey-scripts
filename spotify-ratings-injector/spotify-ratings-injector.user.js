// ==UserScript==
// @name         Spotify AOTY User Ratings Injector
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Injects user ratings from Album of The Year into Spotify album pages, including album ratings
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

    // Variables to keep track of observers and last URL
    let lastAlbumURL = location.href;
    let domObserver = null;

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
        // Uncomment the line below for debugging
        // console.log(`[AOTY Injector] ${message}`);
    }

    // Function to inject CSS for pulse effect and enhanced placeholders
    function injectCSS() {
        if (document.getElementById('aoty-injector-css')) {
            return; // CSS already injected
        }
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
                width: 27px;
                height: 21px;
                margin-left: 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                color: #000;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .aoty-placeholder {
                width: 27px;
                height: 21px;
                background-color: #ccc;
                border-radius: 4px;
                animation: pulse 1.5s infinite;
                display: inline-block;
            }
            .aoty-album-rating {
                white-space: nowrap;
                width: auto;
                height: 100%;
                margin-left: 12px;
                display: flex;
                align-items: center;
            }
            .aoty-album-placeholder {
                width: 89.25px;
                height: 77px;
                background-color: #ccc;
                border-radius: 4px;
                animation: pulse 1.5s infinite;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                font-size: 1em;
            }
            .aoty-album-rating-value {
                white-space: nowrap;
                width: auto;
                height: 100%;
                font-size: 1.2em;
                display: flex;
                align-items: center;
                font-weight: unset;
                display: none;
                color: #000;
                border-radius: 4px;
                padding: 0.25rem 0.6rem;
            }
        `;
        const style = document.createElement('style');
        style.id = 'aoty-injector-css';
        style.textContent = css;
        document.head.appendChild(style);
        log('Injected custom CSS for ratings.');
    }

    // Function to create a placeholder element
    function createPlaceholder() {
        const placeholder = document.createElement('span');
        placeholder.className = 'aoty-placeholder';
        return placeholder;
    }

    // Function to create a custom placeholder for album rating
    function createAlbumPlaceholder() {
        const placeholder = document.createElement('span');
        placeholder.className = 'aoty-album-placeholder';
        return placeholder;
    }

    // Function to normalize song names by removing "feat." and anything after
    function normalizeSongName(name) {
        const featRegex = /\s+(feat\.|ft\.|featuring|feat|ft)\s+.+$/i;
        return name.replace(featRegex, '').trim().toLowerCase();
    }

    // Function to inject ratings placeholders into Spotify page for individual songs
    function injectRatings(ratingsMap) {
        log('Injecting song ratings placeholders into Spotify page.');

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
                const songLinkAnchor = songLink.parentElement;

                // Ensure flex layout is applied
                songLinkAnchor.style.display = 'flex';
                songLinkAnchor.style.alignItems = 'center';

                // Remove existing rating if present
                const existingRating = songLinkAnchor.querySelector('.aoty-rating');
                if (existingRating) {
                    existingRating.remove();
                }

                // Create the rating element
                const ratingSpan = document.createElement('span');
                ratingSpan.className = 'aoty-rating';

                if (ratingsMap !== null) {
                    const rating = ratingsMap[songNameLower];
                    if (rating !== undefined && !isNaN(rating)) {
                        ratingSpan.textContent = rating;
                        ratingSpan.style.background = getGradientColor(rating);
                        ratingSpan.title = `${rating} User Score`;
                        log(`Injected rating for song: "${songName}" with rating ${rating}`);
                    } else {
                        ratingSpan.textContent = 'N/A';
                        ratingSpan.style.background = 'grey';
                        ratingSpan.title = 'No Ratings Available';
                        log(`No rating found for song: "${songName}"`);
                    }
                } else {
                    // Append a placeholder initially
                    const placeholder = createPlaceholder();
                    ratingSpan.appendChild(placeholder);
                    log(`Injected placeholder for song: "${songName}"`);
                }

                // Insert the rating next to the song name
                songLinkAnchor.appendChild(ratingSpan);
            }
        });

        log('Song ratings placeholders injected.');
    }

    // Function to inject rating placeholder for the album title
    function injectAlbumRating() {
        log('Injecting album rating placeholder into Spotify page.');

        // Select the album title element
        const albumTitleElement = document.querySelector('h1[data-encore-id="text"]');
        if (albumTitleElement) {
            // Ensure flex layout is applied to align rating properly
            albumTitleElement.style.display = 'flex';
            albumTitleElement.style.alignItems = 'center';

            // Remove existing album rating if present
            const existingAlbumRating = albumTitleElement.querySelector('.aoty-album-rating');
            if (existingAlbumRating) {
                existingAlbumRating.remove();
            }

            // Create the album rating container
            const albumRatingContainer = document.createElement('span');
            albumRatingContainer.className = 'aoty-album-rating';

            // Create the placeholder
            const placeholder = createAlbumPlaceholder();

            // Create the actual rating span
            const ratingValueSpan = document.createElement('span');
            ratingValueSpan.className = 'aoty-album-rating-value';

            // Append both to the container
            albumRatingContainer.appendChild(placeholder);
            albumRatingContainer.appendChild(ratingValueSpan);

            // Insert the album rating container next to the album title
            albumTitleElement.appendChild(albumRatingContainer);

            log('Injected album rating placeholder.');
        } else {
            log('Album title element not found. Cannot inject album rating.');
        }
    }

    // Function to update placeholders with actual song ratings
    function updateRatings(ratingsMap) {
        log('Updating song rating placeholders with actual ratings.');

        // Select all rating elements for songs
        const ratingElements = document.querySelectorAll('.aoty-rating');

        ratingElements.forEach(ratingSpan => {
            // Check if it's a placeholder
            if (ratingSpan.querySelector('.aoty-placeholder') || ratingSpan.textContent === 'N/A') {
                // Find the associated song name
                const songLinkDiv = ratingSpan.parentElement.querySelector('div[data-encore-id="text"]');
                if (songLinkDiv) {
                    const songName = songLinkDiv.textContent.trim();
                    const songNameLower = normalizeSongName(songName);
                    const rating = ratingsMap ? ratingsMap[songNameLower] : null;

                    // Remove existing content (placeholder)
                    ratingSpan.innerHTML = '';

                    if (rating !== null && !isNaN(rating)) {
                        ratingSpan.textContent = rating;
                        ratingSpan.style.background = getGradientColor(rating);
                        ratingSpan.title = `${rating} User Score`;
                        log(`Updated rating for song: "${songName}" to ${rating}`);
                    } else if (ratingsMap !== null) {
                        ratingSpan.textContent = 'N/A';
                        ratingSpan.style.background = 'grey';
                        ratingSpan.title = 'No Ratings Available';
                        log(`No rating available for song: "${songName}"`);
                    } else {
                        ratingSpan.textContent = 'N/A';
                        ratingSpan.style.background = 'grey';
                        ratingSpan.title = 'No Ratings Available';
                        log(`Failed to update rating for song: "${songName}"`);
                    }
                }
            }
        });

        log('Song ratings updated.');
    }

    // Function to update the album rating placeholder with the actual rating
    function updateAlbumRating(rating) {
        log('Updating album rating placeholder with actual rating.');

        // Select the album rating container
        const albumTitleElement = document.querySelector('h1[data-encore-id="text"]');
        if (albumTitleElement) {
            const albumRatingContainer = albumTitleElement.querySelector('.aoty-album-rating');
            if (albumRatingContainer) {
                const placeholder = albumRatingContainer.querySelector('.aoty-album-placeholder');
                const ratingValueSpan = albumRatingContainer.querySelector('.aoty-album-rating-value');

                if (ratingValueSpan) {
                    if (rating !== null && !isNaN(rating)) {
                        ratingValueSpan.textContent = rating;
                        ratingValueSpan.style.background = getGradientColor(rating);
                        ratingValueSpan.title = `${rating} User Score`;
                        ratingValueSpan.style.display = 'flex';
                        log(`Updated album rating to ${rating}`);
                    } else {
                        ratingValueSpan.textContent = 'N/A';
                        ratingValueSpan.style.background = 'grey';
                        ratingValueSpan.title = 'No Ratings Available';
                        ratingValueSpan.style.display = 'flex';
                        log('No album rating available.');
                    }
                }

                if (placeholder) {
                    // Hide the placeholder
                    placeholder.style.width = '0';
                    placeholder.style.height = '0';
                    placeholder.style.padding = '0';
                    placeholder.style.margin = '0';
                    placeholder.style.visibility = 'hidden';
                }
            } else {
                log('Album rating container not found. Cannot update album rating.');
            }
        } else {
            log('Album title element not found. Cannot update album rating.');
        }
    }

    // Function to observe changes in the track list and inject ratings for new tracks
    function observeDOMChanges(ratingsMap) {
        // Disconnect any existing observer
        if (domObserver) {
            domObserver.disconnect();
        }

        // Select the element that contains the tracklist
        const tracklistElement = document.querySelector('div[data-testid="track-list"]');
        if (!tracklistElement) {
            log('Tracklist element not found. Cannot observe DOM changes.');
            return;
        }

        domObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Re-inject ratings for new tracks
                injectRatings(ratingsMap);
            });
        });

        domObserver.observe(tracklistElement, { childList: true, subtree: true });
        log('Started observing DOM changes for tracklist.');
    }

    // Function to listen for URL changes using history API interception
    function observeURLChanges() {
        // Save original pushState and replaceState functions
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        function onHistoryChange(event) {
            setTimeout(() => {
                if (location.href !== lastAlbumURL) {
                    if (!location.href.includes('/album/')) {
                        // Not an album page
                        lastAlbumURL = location.href;
                        return;
                    }
                    log('URL changed. Re-initializing script.');
                    lastAlbumURL = location.href;

                    // Disconnect any previous DOM observers
                    if (domObserver) {
                        domObserver.disconnect();
                        domObserver = null;
                    }

                    // Re-initialize the script
                    processAlbumPage();
                }
            }, 100);
        }

        history.pushState = function () {
            originalPushState.apply(this, arguments);
            onHistoryChange();
        };

        history.replaceState = function () {
            originalReplaceState.apply(this, arguments);
            onHistoryChange();
        };

        window.addEventListener('popstate', onHistoryChange);

        log('Started observing URL changes.');
    }

    // Function to process the album page
    async function processAlbumPage() {
        log('Processing album page.');

        // Inject the CSS for placeholders and ratings
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
                injectAlbumRating();  // Inject album rating placeholder

                // Step 4: Construct search URL
                const query = encodeURIComponent(`${artistName} ${albumName}`);
                const searchURL = `https://www.albumoftheyear.org/search/?q=${query}`;
                log(`Constructed Search URL: ${searchURL}`);

                // Step 5: Perform search on AOTY
                GM_xmlhttpRequest({
                    method: "GET",
                    url: searchURL,
                    headers: {
                        "User-Agent": "Mozilla/5.0",
                        "Accept": "text/html"
                    },
                    onload: function (response) {
                        if (response.status !== 200) {
                            log(`Failed to fetch search results. Status: ${response.status}`);
                            updateRatings(null);
                            updateAlbumRating(null);
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
                                    "User-Agent": "Mozilla/5.0",
                                    "Accept": "text/html"
                                },
                                onload: function (albumResponse) {
                                    if (albumResponse.status !== 200) {
                                        log(`Failed to fetch album page. Status: ${albumResponse.status}`);
                                        updateRatings(null);
                                        updateAlbumRating(null);
                                        return;
                                    }

                                    // Parse the album page HTML
                                    const albumDoc = parser.parseFromString(albumResponse.responseText, 'text/html');
                                    const trackRows = albumDoc.querySelectorAll('table.trackListTable tbody tr');

                                    if (trackRows.length === 0) {
                                        log('No track ratings found.');
                                        updateRatings(null);
                                        updateAlbumRating(null);
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

                                    log(`Extracted Song Ratings: ${JSON.stringify(ratingsMap)}`);

                                    // Extract album rating
                                    let albumRating = null;
                                    const albumRatingElement = albumDoc.querySelector('div.albumUserScore a');
                                    if (albumRatingElement) {
                                        const ratingText = albumRatingElement.textContent.trim();
                                        albumRating = parseInt(ratingText, 10);
                                        if (isNaN(albumRating)) {
                                            albumRating = null;
                                        }
                                        log(`Extracted Album Rating: ${albumRating !== null ? albumRating : 'N/A'}`);
                                    } else {
                                        log('Album rating element not found on AOTY page.');
                                    }

                                    // Step 7: Update the placeholders with actual ratings
                                    updateRatings(ratingsMap);
                                    updateAlbumRating(albumRating);

                                    // Step 8: Start observing DOM changes for dynamic content
                                    observeDOMChanges(ratingsMap);
                                },
                                onerror: function (err) {
                                    log(`Error fetching album page: ${err}`);
                                    updateRatings(null);
                                    updateAlbumRating(null);
                                }
                            });
                        } else {
                            log('No search results found.');
                            updateRatings(null);
                            updateAlbumRating(null);
                        }
                    },
                    onerror: function (err) {
                        log(`Error fetching search results: ${err}`);
                        updateRatings(null);
                        updateAlbumRating(null);
                    }
                });
            });
        });
    }

    // Main function to execute the script
    async function main() {
        log('Script started.');
        // Start observing URL changes
        observeURLChanges();

        // Process the initial album page
        processAlbumPage();
    }

    // Execute the main function
    main();

})();
