document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startFffBtn = document.getElementById('start-fff');
    const generateFffQrBtn = document.getElementById('generate-fff-qr');
    const showLeaderboardBtn = document.getElementById('show-leaderboard');
    const resetFffBtn = document.getElementById('reset-fff');
    const fffTimerEl = document.getElementById('fff-timer');
    const fffQuestionContainer = document.getElementById('fff-question-container');
    const fffQuestionEl = document.getElementById('fff-question');
    const fffOptionsEl = document.getElementById('fff-options'); // For displaying the FFF question options
    const qrContainerEl = document.getElementById('qr-container');
    const fffQrCodeEl = document.getElementById('fff-qr-code');
    const leaderboardContainer = document.getElementById('leaderboard-container');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const darkModeToggle = document.getElementById('dark-mode-toggle-fff');
    const body = document.body;

    // FFF State
    let fffQuestionData = null;
    let fffParticipants = []; // Array to store { name: string, answerOrder: string[], time: number, correct: boolean }
    let fffTimerInterval = null;
    let fffTimeLeft = 60;
    let fffRoundActive = false;

    // --- Dark Mode ---
    function applyDarkModePreference() {
        if (localStorage.getItem('darkMode') === 'enabled') {
            body.classList.add('dark-mode');
            if (darkModeToggle) darkModeToggle.checked = true;
        } else {
            body.classList.remove('dark-mode');
            if (darkModeToggle) darkModeToggle.checked = false;
        }
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }
    applyDarkModePreference();

    // --- Fetch FFF Question ---
    async function fetchFFFQuestion() {
        try {
            const response = await fetch('data/questions.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            fffQuestionData = data.fffQuestion;
            console.log('FFF Question loaded:', fffQuestionData);
            displayFFFQuestion(); // Display question text and options on admin/main FFF screen
            console.log("Sending FFF command with data:", fffQuestionData);
            sendFFFCommand({ action: 'startRound', question: fffQuestionData });
        } catch (error) {
            console.error("Could not fetch FFF question:", error);
            fffQuestionEl.textContent = 'Error loading FFF question.';
        }
    }

    // --- Display FFF Question (on fff.html) ---
    function displayFFFQuestion() {
        if (!fffQuestionData) return;
        fffQuestionEl.textContent = fffQuestionData.question;
        fffOptionsEl.innerHTML = ''; // Clear previous options

        // Display options (A, B, C, D) - Note: FFF requires ordering, not selection
        Object.entries(fffQuestionData.options).forEach(([key, value]) => {
            const optionDiv = document.createElement('div');
            // Re-use styling but maybe make non-clickable on this screen
            optionDiv.classList.add('fff-option'); 
            optionDiv.style.cursor = 'default'; // Not clickable here

            const letterDiv = document.createElement('div');
            letterDiv.classList.add('option-letter');
            letterDiv.textContent = key;

            const textDiv = document.createElement('div');
            textDiv.classList.add('option-text');
            textDiv.textContent = value;

            optionDiv.appendChild(letterDiv);
            optionDiv.appendChild(textDiv);
            fffOptionsEl.appendChild(optionDiv);
        });
    }

    // --- Generate QR Code ---
    function generateFFFQRCode() {
        fffQrCodeEl.innerHTML = ''; // Clear previous QR code
        // URL points to the mobile participation page
        const mobileUrl = `${window.location.origin}/kbc-app/mobile.html?round=fff`;
        console.log("Mobile URL for QR code:", mobileUrl);
        try {
            const qr = qrcode(0, 'M');
            qr.addData(mobileUrl);
            qr.make();
            fffQrCodeEl.innerHTML = qr.createImgTag(5); // Slightly larger QR code
            qrContainerEl.style.display = 'block'; // Show QR container
        } catch (e) {
            console.error("Error generating FFF QR code:", e);
            fffQrCodeEl.textContent = 'Error generating QR code.';
        }
    }

    // --- FFF Timer ---
    function startFFFTimer() {
        clearInterval(fffTimerInterval);
        fffTimeLeft = 60;
        fffTimerEl.textContent = fffTimeLeft;
        fffTimerEl.classList.remove('pulse');
        fffQuestionContainer.style.display = 'block'; // Show question and timer

        fffTimerInterval = setInterval(() => {
            fffTimeLeft--;
            fffTimerEl.textContent = fffTimeLeft;
            if (fffTimeLeft <= 10 && !fffTimerEl.classList.contains('pulse')) {
                fffTimerEl.classList.add('pulse');
            }
            if (fffTimeLeft <= 0) {
                endFFFRound();
            }
        }, 1000);
    }

    function stopFFFTimer() {
        clearInterval(fffTimerInterval);
        fffTimerEl.classList.remove('pulse');
    }

    // --- Start FFF Round ---
    function startFFFRound() {
        if (!fffQuestionData) {
            alert("FFF Question not loaded yet.");
            return;
        }
        if (fffRoundActive) {
            alert("FFF round is already active.");
            return;
        }
        console.log("Starting FFF Round");
        fffRoundActive = true;
        fffParticipants = []; // Clear previous participants
        leaderboardContainer.style.display = 'none'; // Hide leaderboard
        qrContainerEl.style.display = 'none'; // Hide QR once round starts
        
        startFFFTimer();
    }

    // --- End FFF Round ---
    function endFFFRound() {
        if (!fffRoundActive) return;
        console.log("Ending FFF Round");
        stopFFFTimer();
        fffRoundActive = false;
        fffQuestionContainer.style.display = 'none'; // Hide question area
        
        // Send command to mobile clients to stop
        sendFFFCommand({ action: 'endRound' });
        
        // Process results and show leaderboard automatically
        processFFFResults();
        displayLeaderboard();
    }

    // --- Reset FFF Round ---
    function resetFFFRound() {
        console.log("Resetting FFF Round");
        stopFFFTimer();
        fffRoundActive = false;
        fffParticipants = [];
        fffQuestionContainer.style.display = 'none';
        leaderboardContainer.style.display = 'none';
        qrContainerEl.style.display = 'block'; // Show QR again
        fffTimerEl.textContent = '60';
        generateFFFQRCode(); // Regenerate QR in case URL changes or for clarity
        sendFFFCommand({ action: 'resetRound' }); // Inform mobile clients
    }

    // --- Process FFF Results (Read from file) ---
    async function processFFFResults() {
        if (!fffQuestionData) return;
        const correctOrderStr = fffQuestionData.correctOrder.join('');

        try {
            const response = await fetch('data/fff_results.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const fffResultsData = await response.json();

            fffParticipants = fffResultsData.map(p => ({
                name: p.name,
                answerOrder: p.answerOrder,
                time: p.time,
                correct: false // Will be evaluated later
            }));

            fffParticipants.forEach(p => {
                const participantOrderStr = p.answerOrder.join('');
                p.correct = participantOrderStr === correctOrderStr;
            });

            // Sort by correctness (correct first) then by time (fastest first)
            fffParticipants.sort((a, b) => {
                if (a.correct && !b.correct) return -1;
                if (!a.correct && b.correct) return 1;
                // If both correct or both incorrect, sort by time
                return a.time - b.time;
            });

            console.log("Processed FFF Results:", fffParticipants);

        } catch (error) {
            console.error("Error reading or processing FFF results:", error);
            alert("Could not load FFF results.");
            fffParticipants = []; // Ensure leaderboard doesn't try to display invalid data
        }
    }

    // --- Send Command to Mobile Clients (via LocalStorage) ---
    function sendFFFCommand(command) {
        console.log('FFF Admin sending command:', command);
        localStorage.setItem('kbcFFFCommand', JSON.stringify({ ...command, timestamp: Date.now() }));
    }

    // --- Simulate API call to submit FFF response ---
    async function submitFFFResponse(submissionData) {
        const filePath = 'data/fff_results.json';
        try {
            // Attempt to read existing data
            let existingData = [];
            try {
                const response = await fetch(filePath);
                if (response.ok) {
                    existingData = await response.json();
                } else if (response.status === 404) {
                    // File doesn't exist, so start with an empty array
                    existingData = [];
                } else {
                    console.error("Error reading FFF data file:", response.status);
                    // Handle the error appropriately, maybe show a message to the user
                    return;
                }
            } catch (e) {
                console.warn("Could not parse existing FFF data (may be empty or invalid JSON), starting fresh.", e);
                existingData = []; // Start with a clean slate if parsing fails
            }

            // Add the new submission data
            existingData.push(submissionData);

            // Write the combined data back to the file
            const jsonData = JSON.stringify(existingData, null, 2); // Pretty print for readability
            
            // Use the write_to_file tool
            await writeToFile(filePath, jsonData);

        } catch (error) {
            console.error("Error writing FFF data to file:", error);
            // Handle the error appropriately, maybe show a message to the user
        }
    }

    // --- Helper function to use the write_to_file tool ---
    async function writeToFile(path, content) {
        // This function is a placeholder for the actual tool call
        // In a real environment, you would use the provided tool
        console.log(`Simulating writing to file: ${path} with content: ${content}`);
        // Here, I'm using a Promise to simulate the asynchronous nature of the tool
        return new Promise((resolve, reject) => {
            // Simulate success after a short delay
            setTimeout(() => {
                // In a real implementation, you would check the tool's response for success/failure
                resolve({ success: true });
            }, 50);
        });
    }

    // --- Event Listeners for Admin Controls ---
    generateFffQrBtn.addEventListener('click', generateFFFQRCode);
    startFffBtn.addEventListener('click', startFFFRound);
    showLeaderboardBtn.addEventListener('click', async () => {
        // Manually trigger processing and display if round hasn't ended automatically
        if (!fffRoundActive) {
            await processFFFResults();
            displayLeaderboard();
        } else {
            alert("Cannot show final leaderboard while round is active.");
        }
    });
    resetFffBtn.addEventListener('click', resetFFFRound);

    // --- Initial Load ---
    fetchFFFQuestion();
    generateFFFQRCode(); // Generate QR on load

});
