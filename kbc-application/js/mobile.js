document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const participantForm = document.getElementById('participant-form');
    const participantNameInput = document.getElementById('participant-name');
    const submitNameBtn = document.getElementById('submit-name');
    const waitingScreen = document.getElementById('waiting-screen');
    const questionContainer = document.getElementById('question-container');
    const mobileTimerEl = document.getElementById('mobile-timer');
    const mobileQuestionEl = document.getElementById('mobile-question');
    const mobileOptionsEl = document.getElementById('mobile-options');
    const thankYouScreen = document.getElementById('thank-you');
    const responseTimeEl = document.getElementById('response-time');
    const timeUpScreen = document.getElementById('time-up');
    const resultsScreen = document.getElementById('results-screen');
    const resultMessageEl = document.getElementById('result-message');
    const leaderboardPositionEl = document.getElementById('leaderboard-position');
    const darkModeToggle = document.getElementById('dark-mode-toggle-mobile');
    const body = document.body;

    // FFF Mobile State
    let participantName = null;
    let fffQuestionData = null;
    let answerOrder = [];
    let startTime = null;
    let endTime = null;
    let mobileTimerInterval = null;
    let mobileTimeLeft = 60;
    let roundActive = false;
    let submissionSent = false;

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

    // --- Handle Name Submission ---
    submitNameBtn.addEventListener('click', () => {
        participantName = participantNameInput.value.trim();
        if (participantName) {
            participantForm.style.display = 'none';
            waitingScreen.style.display = 'block'; // Show waiting screen
            console.log(`Participant ${participantName} registered. Waiting for round start.`);
        } else {
            alert('Please enter your name.');
        }
    });

    // --- Display FFF Question on Mobile ---
    function displayMobileFFFQuestion() {
        if (!fffQuestionData) return;
        mobileQuestionEl.textContent = fffQuestionData.question;
        mobileOptionsEl.innerHTML = ''; // Clear previous options
        answerOrder = []; // Reset answer order

        // Create clickable options for ordering
        Object.entries(fffQuestionData.options).forEach(([key, value]) => {
            const optionDiv = document.createElement('div');
            optionDiv.classList.add('poll-option'); // Reuse poll styling
            optionDiv.dataset.option = key;

            const letterDiv = document.createElement('div');
            letterDiv.classList.add('option-letter');
            letterDiv.textContent = key;

            const textDiv = document.createElement('div');
            textDiv.classList.add('option-text');
            textDiv.textContent = value;

            optionDiv.appendChild(letterDiv);
            optionDiv.appendChild(textDiv);
            optionDiv.addEventListener('click', handleFFFMobileOptionClick);
            mobileOptionsEl.appendChild(optionDiv);
        });
    }

    // --- Handle Option Click for Ordering ---
    function handleFFFMobileOptionClick(event) {
        if (!roundActive || submissionSent) return;

        const selectedOptionElement = event.currentTarget;
        const selectedOptionKey = selectedOptionElement.dataset.option;

        // Prevent selecting the same option twice in sequence
        if (answerOrder.length > 0 && answerOrder[answerOrder.length - 1] === selectedOptionKey) {
            return; 
        }

        // Add to order and provide visual feedback
        answerOrder.push(selectedOptionKey);
        selectedOptionElement.style.opacity = '0.5'; // Dim selected option
        selectedOptionElement.style.border = '2px solid var(--secondary-color)';
        
        // Add number indicator
        const orderIndicator = document.createElement('span');
        orderIndicator.textContent = ` (${answerOrder.length})`;
        orderIndicator.style.fontWeight = 'bold';
        orderIndicator.style.marginLeft = '10px';
        selectedOptionElement.appendChild(orderIndicator);


        // Check if all options are selected
        if (answerOrder.length === Object.keys(fffQuestionData.options).length) {
            submitFFFAnswer();
        }
    }

    // --- Mobile Timer ---
    function startMobileTimer() {
        clearInterval(mobileTimerInterval);
        mobileTimeLeft = 60;
        mobileTimerEl.textContent = mobileTimeLeft;

        mobileTimerInterval = setInterval(() => {
            mobileTimeLeft--;
            mobileTimerEl.textContent = mobileTimeLeft;
            if (mobileTimeLeft <= 0) {
                stopMobileTimer();
                if (roundActive && !submissionSent) {
                    showTimeUpScreen();
                }
            }
        }, 1000);
    }

    function stopMobileTimer() {
        clearInterval(mobileTimerInterval);
    }

    // --- Submit FFF Answer ---
    function submitFFFAnswer() {
        if (!roundActive || submissionSent) return;

        stopMobileTimer();
        endTime = performance.now();
        const timeTaken = (endTime - startTime) / 1000; // Time in seconds
        submissionSent = true;
        roundActive = false; // Round ends for this user upon submission

        console.log(`Submitting FFF answer for ${participantName}: ${answerOrder.join(', ')} in ${timeTaken.toFixed(2)}s`);

        // Send submission to FFF admin screen via LocalStorage
        const submissionData = {
            name: participantName,
            answerOrder: answerOrder,
            time: timeTaken,
            timestamp: Date.now()
        };
        localStorage.setItem('kbcFFFSubmission', JSON.stringify(submissionData));

        // Show thank you message
        questionContainer.style.display = 'none';
        responseTimeEl.textContent = timeTaken.toFixed(2);
        thankYouScreen.style.display = 'block';

        // Disable options
        mobileOptionsEl.querySelectorAll('.poll-option').forEach(opt => {
            opt.removeEventListener('click', handleFFFMobileOptionClick);
            opt.style.cursor = 'not-allowed';
        });
    }

    // --- Show Screens ---
    function showWaitingScreen() {
        participantForm.style.display = 'none';
        questionContainer.style.display = 'none';
        thankYouScreen.style.display = 'none';
        timeUpScreen.style.display = 'none';
        resultsScreen.style.display = 'none';
        waitingScreen.style.display = 'block';
    }

    function showQuestionScreen() {
        waitingScreen.style.display = 'none';
        thankYouScreen.style.display = 'none';
        timeUpScreen.style.display = 'none';
        resultsScreen.style.display = 'none';
        questionContainer.style.display = 'block';
    }

    function showTimeUpScreen() {
        stopMobileTimer();
        roundActive = false;
        questionContainer.style.display = 'none';
        thankYouScreen.style.display = 'none';
        resultsScreen.style.display = 'none';
        timeUpScreen.style.display = 'block';
         // Disable options
        mobileOptionsEl.querySelectorAll('.poll-option').forEach(opt => {
            opt.removeEventListener('click', handleFFFMobileOptionClick);
            opt.style.cursor = 'not-allowed';
            opt.style.opacity = '0.6';
        });
    }
    
    function showResultsScreen(message, position) {
        questionContainer.style.display = 'none';
        thankYouScreen.style.display = 'none';
        timeUpScreen.style.display = 'none';
        waitingScreen.style.display = 'none';
        
        resultMessageEl.textContent = message;
        leaderboardPositionEl.textContent = position ? `Your Rank: ${position}` : '';
        resultsScreen.style.display = 'block';
    }


    // --- Listen for Commands from FFF Admin (via LocalStorage) ---
    window.addEventListener('storage', (event) => {
        if (event.key === 'kbcFFFCommand') {
            // Only process if name has been submitted
            if (!participantName) return; 
            
            try {
                const command = JSON.parse(event.newValue);
                console.log(`Mobile received FFF command:`, command);

                if (command.action === 'startRound') {
                    if (!roundActive) { // Prevent starting multiple times
                        fffQuestionData = command.question;
                        roundActive = true;
                        submissionSent = false;
                        startTime = performance.now();
                        displayMobileFFFQuestion();
                        showQuestionScreen();
                        startMobileTimer();
                    }
                } else if (command.action === 'endRound') {
                    if (roundActive && !submissionSent) {
                        // If round ended before submission
                        showTimeUpScreen();
                    }
                    // Could potentially show final results here based on admin command
                } else if (command.action === 'resetRound') {
                    // Reset the mobile client state
                    stopMobileTimer();
                    roundActive = false;
                    submissionSent = false;
                    fffQuestionData = null;
                    answerOrder = [];
                    showWaitingScreen(); // Go back to waiting
                }
                // Add handling for other commands if needed (e.g., showing results directly)

            } catch (e) {
                console.error("Error parsing FFF command:", e);
            }
        }
    });

    // --- Initial State ---
    participantForm.style.display = 'block';
    waitingScreen.style.display = 'none';
    questionContainer.style.display = 'none';
    thankYouScreen.style.display = 'none';
    timeUpScreen.style.display = 'none';
    resultsScreen.style.display = 'none';

});
