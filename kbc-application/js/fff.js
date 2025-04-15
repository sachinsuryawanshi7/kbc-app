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
        const mobileUrl = `${window.location.origin}/mobile.html?round=fff`; 
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
        
        // Send command to mobile clients to start
        sendFFFCommand({ action: 'startRound', question: fffQuestionData });
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

    // --- Process FFF Results ---
    function processFFFResults() {
        if (!fffQuestionData) return;
        const correctOrderStr = fffQuestionData.correctOrder.join('');

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
    }

    // --- Display Leaderboard ---
    function displayLeaderboard() {
        leaderboardBody.innerHTML = ''; // Clear previous entries
        const top10 = fffParticipants.slice(0, 10);

        top10.forEach((p, index) => {
            const row = leaderboardBody.insertRow();
            row.insertCell(0).textContent = index + 1; // Rank
            row.insertCell(1).textContent = p.name;
            row.insertCell(2).textContent = p.correct ? `${p.time.toFixed(2)}s` : 'Incorrect';

            if (p.correct) {
                row.style.backgroundColor = 'var(--correct-answer)';
                row.style.color = 'var(--light-text)';
            } else {
                 row.style.opacity = '0.7';
            }
            // Highlight the winner (rank 1 and correct)
            if (index === 0 && p.correct) {
                row.style.fontWeight = 'bold';
                row.style.border = '2px solid var(--accent-color)';
            }
        });

        leaderboardContainer.style.display = 'block'; // Show the leaderboard
    }

    // --- Send Command to Mobile Clients (via LocalStorage) ---
    function sendFFFCommand(command) {
        console.log('FFF Admin sending command:', command);
        localStorage.setItem('kbcFFFCommand', JSON.stringify({ ...command, timestamp: Date.now() }));
    }

    // --- Listen for Mobile Client Submissions (via LocalStorage) ---
    window.addEventListener('storage', (event) => {
        if (event.key === 'kbcFFFSubmission' && fffRoundActive) {
            try {
                const submission = JSON.parse(event.newValue);
                console.log('FFF Admin received submission:', submission);

                // Avoid duplicate submissions from the same participant
                if (!fffParticipants.some(p => p.name === submission.name)) {
                    fffParticipants.push({
                        name: submission.name,
                        answerOrder: submission.answerOrder,
                        time: submission.time,
                        correct: false // Will be evaluated later
                    });
                } else {
                    console.warn(`Duplicate submission from ${submission.name} ignored.`);
                }
            } catch (e) {
                console.error("Error parsing FFF submission:", e);
            }
        }
    });

    // --- Event Listeners for Admin Controls ---
    generateFffQrBtn.addEventListener('click', generateFFFQRCode);
    startFffBtn.addEventListener('click', startFFFRound);
    showLeaderboardBtn.addEventListener('click', () => {
        // Manually trigger processing and display if round hasn't ended automatically
        if (!fffRoundActive) {
            processFFFResults();
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
