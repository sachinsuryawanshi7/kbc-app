document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const questionNumberEl = document.getElementById('question-number');
    const timerEl = document.getElementById('timer');
    const questionTextEl = document.getElementById('question-text');
    const optionsGridEl = document.getElementById('options-grid');
    const moneyLevelsEl = document.getElementById('money-levels');
    const lifelines = {
        fiftyFifty: document.getElementById('fifty-fifty'),
        swapQuestion: document.getElementById('swap-question'),
        audiencePoll: document.getElementById('audience-poll'),
        doubleDip: document.getElementById('double-dip') // Replaced phoneFriend with doubleDip
    };
    const qrContainerEl = document.getElementById('qr-container'); // Container *inside* the modal now
    const qrCodeEl = document.getElementById('qr-code');
    const pollResultsEl = document.getElementById('poll-results');
    const pollChartCanvas = document.getElementById('poll-chart');
    const darkModeToggle = document.getElementById('dark-mode-toggle-game');
    const body = document.body;

    // Modal Elements
    const pollModal = document.getElementById('poll-modal');
    const closePollModalBtn = document.getElementById('close-poll-modal');
    const pollQrTimerEl = document.getElementById('poll-qr-timer');
    const qrExpiredMessageEl = document.getElementById('qr-expired-message');

    // Game Over Modal Elements
    const gameOverModal = document.getElementById('game-over-modal');
    const closeGameOverModalBtn = document.getElementById('close-game-over-modal');
    const gameOverTitleEl = document.getElementById('game-over-title');
    const gameOverMessageEl = document.getElementById('game-over-message');
    const gameOverAmountEl = document.getElementById('game-over-amount');

    // Poll Results Modal Elements
    const pollResultsModal = document.getElementById('poll-results-modal');
    const closePollResultsModalBtn = document.getElementById('close-poll-results-modal');


    // Game State
    let allQuestions = []; // Renamed from questions
    let users = [];
    let currentUser = null; // The user currently playing
    let currentQuestion = null; // The question object currently displayed
    let askedQuestionIds = new Set(); // IDs of questions asked across ALL users
    let timerInterval = null; // Main question timer
    let timeLeft = 60;
    let pollChart = null;
    let pollQrTimerInterval = null; // Separate timer for QR code expiry
    let pollQrTimeLeft = 60;
    let selectedOptionElement = null; // Track the clicked option element
    let lastSelectedOptionKey = null; // Track the key of the clicked option
    let doubleDipActive = false; // State for Double Dip lifeline
    let doubleDipAttempt = 1; // Attempt counter for Double Dip lifeline

    // Audio Elements (assuming they exist in HTML or created dynamically)
    const correctSound = document.getElementById('correct-sound'); // Placeholder ID
    const wrongSound = document.getElementById('wrong-sound'); // Placeholder ID
    const clockSound = document.getElementById('clock-sound'); // Added clock sound element

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
    applyDarkModePreference(); // Apply on initial load

    // --- Fetch Data (Questions and Users) ---
    async function fetchData() {
        try {
            const [questionsResponse, usersResponse] = await Promise.all([
                fetch('data/questions.json'),
                fetch('data/users.json') // Fetch user data
            ]);

            if (!questionsResponse.ok) throw new Error(`HTTP error! status: ${questionsResponse.status}`);
            if (!usersResponse.ok) throw new Error(`HTTP error! status: ${usersResponse.status}`);

            const questionsData = await questionsResponse.json();
            const usersData = await usersResponse.json();

            allQuestions = questionsData.questions;
            users = usersData;
            console.log('Questions loaded:', allQuestions);
            console.log('Users loaded:', users);

            // Initialize asked questions set from all users' progress
            users.forEach(user => {
                user.progress.questionsAttempted.forEach(id => askedQuestionIds.add(id));
            });
            console.log('Initial askedQuestionIds:', askedQuestionIds);

            // For now, select the first user or based on a simple mechanism (e.g., localStorage)
            // TODO: Implement proper user switching mechanism via admin panel
            selectUser(users[0]?.id || 1); // Select first user by default

            initializeGame();

        } catch (error) {
            console.error("Could not fetch data:", error);
            questionTextEl.textContent = 'Error loading game data. Please try again later.';
        }
    }

    // --- Select User ---
    function selectUser(userId) {
        currentUser = users.find(u => u.id === userId);
        if (!currentUser) {
            console.error(`User with ID ${userId} not found.`);
            // Handle error, maybe default to first user or show message
            currentUser = users[0];
        }
        console.log(`Selected user: ${currentUser.name} (ID: ${currentUser.id})`);
        // Reset UI elements related to user state if needed
    }


    // --- Initialize Game ---
    function initializeGame() {
        if (!currentUser || allQuestions.length === 0) {
            console.error("Cannot initialize game: No current user or no questions.");
            questionTextEl.textContent = 'Game cannot start. User or questions missing.';
            return;
        }
        // Load state from currentUser
        console.log(`Initializing game for ${currentUser.name}`);
        console.log('User progress:', JSON.stringify(currentUser.progress));

        updateMoneyTree(); // Update based on all questions initially
        updateLifelineUI(); // Update based on currentUser's used lifelines
        loadNextQuestion(); // Load the next appropriate question for the user
    }

    // --- Load Next Question ---
    function loadNextQuestion() {
        if (!currentUser) return;

        // Find the next question that hasn't been asked globally
        let nextQuestion = null;
        let nextQuestionIndexInAll = -1; // Index in the allQuestions array

        // Start searching from the user's last known index + 1, or from 0 if starting
        const searchStartIndex = currentUser.progress.currentQuestionIndex; // This index relates to the *level*, not the position in allQuestions array

        // Find the question corresponding to the user's current level index
        const targetQuestionLevel = searchStartIndex + 1;
        nextQuestion = allQuestions.find(q => q.id === targetQuestionLevel && !askedQuestionIds.has(q.id));

        // If the direct next level question was already asked, find the *next available* unasked question
        if (!nextQuestion) {
             for (let i = 0; i < allQuestions.length; i++) {
                const question = allQuestions[i];
                // Find the first question with ID >= target level that hasn't been asked
                if (question.id >= targetQuestionLevel && !askedQuestionIds.has(question.id)) {
                    nextQuestion = question;
                    break;
                }
            }
        }


        if (!nextQuestion) {
            // Check if all questions are exhausted or if the user has completed the available ones
            if (askedQuestionIds.size >= allQuestions.length) {
                 endGame("Congratulations! You've answered all available questions!", 'won');
            } else {
                 // This might happen if lower level questions were skipped/asked by others
                 // and higher level ones are left. Or simply, no more questions for this user.
                 // Let's assume completion for now.
                 endGame(`Congratulations ${currentUser.name}! You've completed the game!`, 'won');
            }
            return;
        }

        currentQuestion = nextQuestion; // Set the globally accessible current question
        currentUser.progress.currentQuestionIndex = currentQuestion.id; // Update user progress to the *level* (ID) of the current question
        currentUser.progress.questionsAttempted.push(currentQuestion.id); // Add to user's attempted list
        askedQuestionIds.add(currentQuestion.id); // Add to globally asked list

        // --- State Update ---
        // Set the user's target level to the ID of the question being loaded
        currentUser.progress.currentQuestionIndex = nextQuestion.id;
        // Mark this question as attempted *by this user* and *globally*
        currentUser.progress.questionsAttempted.push(nextQuestion.id);
        askedQuestionIds.add(nextQuestion.id);
        console.log(`User ${currentUser.name} is now attempting level ${currentUser.progress.currentQuestionIndex} (Question ID: ${nextQuestion.id})`);
        saveUserState(); // Save the updated state

        // --- Display ---
        displayQuestion(nextQuestion); // Use the refactored display function
    }

    // --- Display Question (New Refactored Function) ---
    function displayQuestion(questionData) {
        if (!questionData) {
            console.error("displayQuestion called with null data");
            return;
        }
        currentQuestion = questionData; // Ensure global currentQuestion is set

        console.log(`Displaying question ID ${currentQuestion.id}: "${currentQuestion.question}"`);

        questionNumberEl.textContent = currentQuestion.id;
        questionTextEl.textContent = currentQuestion.question;
        optionsGridEl.innerHTML = ''; // Clear previous options

        // Reset styles and visibility from potential previous states (like poll)
        pollModal.style.display = 'none';
        pollResultsEl.style.display = 'none';
        if (pollChart) {
            pollChart.destroy();
            pollChart = null;
        }
        // Ensure options are visible if hidden by 50:50 previously and clear result styles
        optionsGridEl.querySelectorAll('.option').forEach(opt => {
            opt.style.visibility = 'visible';
            opt.style.cursor = 'pointer';
            opt.classList.remove('correct', 'wrong', 'disabled', 'wrong-disabled'); // Clear result/state classes including double dip
        });


        ['A', 'B', 'C', 'D'].forEach(key => {
            const optionDiv = document.createElement('div');
            optionDiv.classList.add('option');
            optionDiv.dataset.option = key;

            const letterDiv = document.createElement('div');
            letterDiv.classList.add('option-letter');
            letterDiv.textContent = key;

            const textDiv = document.createElement('div');
            textDiv.classList.add('option-text');
            textDiv.textContent = currentQuestion.options[key];

            optionDiv.appendChild(letterDiv);
            optionDiv.appendChild(textDiv);
            // Re-add event listener (disableOptions removes it)
            optionDiv.removeEventListener('click', handleOptionClick); // Ensure no duplicates
            optionDiv.addEventListener('click', handleOptionClick);
            optionsGridEl.appendChild(optionDiv);
        });

        // Update money tree highlighting the level user is *attempting*
        // Use currentUser.progress.currentQuestionIndex which represents the *level*
        updateMoneyTree(currentUser.progress.currentQuestionIndex);
        resetTimer();
        // Timer start should be controlled by admin
    }


    // --- Timer ---
    function startTimer() {
        // Play clock sound
        if (clockSound) {
            clockSound.currentTime = 0; // Ensure it starts from the beginning
            clockSound.play().catch(error => console.error("Error playing clock sound:", error)); // Play might require interaction
        }

        clearInterval(timerInterval); // Clear any existing timer
        // timeLeft = 60; // Removed: Resume from current timeLeft
        timerEl.textContent = timeLeft;
        timerEl.classList.remove('pulse'); // Remove pulse effect if present

        timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;
            if (timeLeft <= 10 && !timerEl.classList.contains('pulse')) {
                timerEl.classList.add('pulse'); // Add pulse effect for last 10 seconds
            }
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                handleAnswer(null); // Time's up - treated as incorrect
                timerEl.classList.remove('pulse');
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerEl.classList.remove('pulse');
        // Stop clock sound
        if (clockSound) {
            clockSound.pause();
            clockSound.currentTime = 0; // Reset time for next play
        }
    }

    function resetTimer() {
        stopTimer();
        timeLeft = 60;
        timerEl.textContent = timeLeft;
        timerEl.classList.remove('pulse');
    }

    // --- Handle Answer Selection ---
    function handleOptionClick(event) {
        stopTimer(); // Stop timer once an option is clicked
        const clickedOptionElement = event.currentTarget; // Use a different local variable name
        const selectedOptionKey = clickedOptionElement.dataset.option;

        // Disable further clicks (except potentially for Double Dip second chance)
        disableOptions();

        // Add visual feedback (e.g., highlight selected) - Optional
        clickedOptionElement.style.backgroundColor = 'orange'; // Temporary selection indicator

        // Store the selected element and key using the global variables
        selectedOptionElement = clickedOptionElement; // Assign the clicked element to the global variable
        lastSelectedOptionKey = selectedOptionKey; // The key ('A', 'B', 'C', 'D')

        // Send selected answer to admin panel
        localStorage.setItem('kbcAnswerSelected', JSON.stringify({
            userId: currentUser.id,
            questionId: currentQuestion.id,
            selectedOption: selectedOptionKey
        }));

        console.log(`User ${currentUser.name} selected option ${selectedOptionKey}. Waiting for admin marking.`);
        // DO NOT evaluate answer here. Wait for admin command.
    }

    // This function is now primarily for the time-up scenario
    function handleAnswer(selectedOptionKey, selectedElement) { // selectedElement might be null if time ran out
        if (!currentUser || !currentQuestion) return; // Ensure game context is valid

        const correctAnswer = currentQuestion.correctAnswer;
        const options = optionsGridEl.querySelectorAll('.option');

        options.forEach(opt => {
            const key = opt.dataset.option;
            if (key === correctAnswer) {
                opt.classList.add('correct'); // Highlight correct answer
            } else if (key === selectedOptionKey) {
                opt.classList.add('wrong'); // Highlight wrong selected answer
            }
        });

        if (selectedOptionKey === correctAnswer) {
            currentUser.progress.amountWon = currentQuestion.amount;
            currentUser.progress.gameStatus = 'active'; // Still playing
            console.log(`Correct Answer! User ${currentUser.name} won ${currentUser.progress.amountWon}`);
            saveUserState();
            // Play correct sound effect (optional)

            // This part is now handled by the admin 'markAnswer' command response
            // console.log("Waiting for admin to load next question...");
            // updateMoneyTree(currentQuestion.id, true); // Update money tree showing correct

        } else { // Handles incorrect answer OR time up (selectedOptionKey is null)
             if (wrongSound) wrongSound.play(); // Play wrong sound
            console.log(`Incorrect Answer or Time Up! User ${currentUser.name} selected ${selectedOptionKey || 'nothing'}, correct was ${correctAnswer}`);
            // Find the safe milestone amount
            let finalAmount = 0;
            // Iterate backwards through ALL questions up to the current level ID
            for (let i = allQuestions.length - 1; i >= 0; i--) {
                const q = allQuestions[i];
                // Find the highest milestone amount at or below the question *before* the current one
                if (q.milestone && q.id < currentQuestion.id) {
                    finalAmount = q.amount;
                    break; // Found the highest relevant milestone
                }
            }
            // Removed extra brace from line 232
            currentUser.progress.amountWon = finalAmount; // Set final amount based on milestone
            endGame(`Sorry, that was incorrect. ${currentUser.name} walks away with ₹${finalAmount.toLocaleString()}.`, 'gameover');
        }
        // updateMoneyTree(currentQuestion.id, selectedOptionKey === correctAnswer); // Moved inside correct block
    }

    function disableOptions() {
        optionsGridEl.querySelectorAll('.option').forEach(opt => {
            // Don't disable if it's already marked as wrong-disabled from Double Dip
            if (!opt.classList.contains('wrong-disabled')) {
                opt.removeEventListener('click', handleOptionClick);
                opt.style.cursor = 'not-allowed';
                // opt.classList.add('disabled'); // Optional: Add disabled class for styling
            }
        });
    }

    // --- Money Tree ---
    function updateMoneyTree(currentLevelId = 0, justAnsweredCorrectly = false) {
        if (!currentUser) return;
        moneyLevelsEl.innerHTML = ''; // Clear previous levels

        // Determine the highest level reached correctly by the user
        const highestCorrectLevelId = justAnsweredCorrectly
            ? currentLevelId // If just answered correctly, highlight the current level as passed
            : (currentUser.progress.questionsAttempted.length > 0
                ? Math.max(0, ...currentUser.progress.questionsAttempted) // Highest ID they attempted (assuming correct up to previous)
                : 0); // If no attempts, highest is 0

        allQuestions.slice().reverse().forEach(level => { // Iterate reversed for correct display order
            const levelDiv = document.createElement('div');
            levelDiv.classList.add('money-level');
            levelDiv.dataset.levelId = level.id;

            const levelNumberSpan = document.createElement('span');
            levelNumberSpan.textContent = `${level.id}.`;
            levelNumberSpan.style.marginRight = '10px';

            const levelAmountSpan = document.createElement('span');
            levelAmountSpan.textContent = `₹ ${level.amount.toLocaleString()}`;

            levelDiv.appendChild(levelNumberSpan);
            levelDiv.appendChild(levelAmountSpan);

            if (level.milestone) {
                levelDiv.classList.add('milestone');
            }

            // Highlight the level the user is currently attempting
            if (level.id === currentLevelId && currentUser.progress.gameStatus === 'active') {
                 levelDiv.classList.add('current');
            }

            // Highlight levels passed correctly
            // Check if this level's ID is less than or equal to the highest correctly answered level
            // Note: This logic assumes answering q N means you passed level N.
            const lastCorrectQuestionId = currentUser.progress.currentQuestionIndex - (justAnsweredCorrectly ? 0 : 1);
            if (level.id <= lastCorrectQuestionId) {
                 levelDiv.classList.add('passed'); // Style 'passed' levels (e.g., green background)
            }


            moneyLevelsEl.appendChild(levelDiv);
        });
    }

    // --- Save User State (In Memory + LocalStorage for Admin) ---
    function saveUserState() {
        if (!currentUser) return;
        console.log(`Saving state for user ${currentUser.id}:`, JSON.stringify(currentUser.progress));
        // Update the user object in the main 'users' array
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
            users[userIndex] = currentUser;
        }
        // Communicate change to admin panel (basic)
        localStorage.setItem('kbcGameStateUpdate', JSON.stringify({
            userId: currentUser.id,
            progress: currentUser.progress,
            askedQuestionIds: Array.from(askedQuestionIds) // Send updated asked IDs too
        }));
        // TODO: Implement proper saving mechanism (e.g., admin saves to file)
    }

    // --- Lifelines ---
    function updateLifelineUI() {
        if (!currentUser) return;
        const userLifelines = currentUser.progress.lifelinesUsed;
        for (const key in lifelines) {
            // Map button ID (e.g., 'fifty-fifty') to progress key (e.g., 'fiftyFifty')
            const progressKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase()); // fifty-fifty -> fiftyFifty
            if (lifelines[key]) { // Check if the element exists
                if (userLifelines[progressKey]) {
                    lifelines[key].classList.add('used');
                    lifelines[key].removeEventListener('click', handleLifelineClick); // Prevent re-use
                } else {
                    lifelines[key].classList.remove('used');
                    // Ensure listener is attached only once or managed properly
                    lifelines[key].removeEventListener('click', handleLifelineClick); // Remove first to avoid duplicates
                    lifelines[key].addEventListener('click', handleLifelineClick);
                }
            } else {
                // console.warn(`Lifeline element with key '${key}' not found in the DOM.`);
            }
        }
    }

    function handleLifelineClick(event) {
        if (!currentUser) return;
        const lifelineButtonId = event.currentTarget.id; // e.g., 'fifty-fifty'
        const lifelineKey = lifelineButtonId.replace(/-([a-z])/g, (g) => g[1].toUpperCase()); // 'fiftyFifty'

        if (currentUser.progress.lifelinesUsed[lifelineKey]) return; // Already used

        // Lifeline logic will be triggered by admin, this is just placeholder
        console.log(`Lifeline clicked: ${lifelineButtonId}`); // Fixed variable name

        // Send request to admin panel or use shared state (e.g., LocalStorage/WebSocket)
        // For now, we assume admin triggers the actual effect
        alert(`Lifeline ${lifelineButtonId} requested. Waiting for admin activation.`); // Fixed variable name
    }

    // --- Lifeline Effects (To be triggered by Admin for the CURRENT USER) ---
    window.activateFiftyFifty = () => {
        if (!currentUser || currentUser.progress.lifelinesUsed.fiftyFifty || !currentQuestion) return;
        console.log(`Activating 50:50 for user ${currentUser.name}`);
        currentUser.progress.lifelinesUsed.fiftyFifty = true;
        saveUserState();
        updateLifelineUI();

        const correctAnswer = currentQuestion.correctAnswer;
        const wrongOptions = Object.keys(currentQuestion.options).filter(key => key !== correctAnswer);
        
        // Shuffle wrong options and pick two to remove
        wrongOptions.sort(() => 0.5 - Math.random());
        const optionsToRemove = [wrongOptions[0], wrongOptions[1]];

        optionsGridEl.querySelectorAll('.option').forEach(opt => {
            if (optionsToRemove.includes(opt.dataset.option)) {
                opt.style.visibility = 'hidden'; // Hide two wrong options
                opt.removeEventListener('click', handleOptionClick);
                opt.style.cursor = 'default';
            }
        });
    };

    // --- Activate Swap Question (Rewritten) ---
    window.activateSwapQuestion = () => {
        if (!currentUser || currentUser.progress.lifelinesUsed.swapQuestion || !currentQuestion) {
            console.warn("Swap Question activation failed: Preconditions not met.");
            return;
        }
        console.log(`Attempting Swap Question for user ${currentUser.name} (Current Q ID: ${currentQuestion.id})`);

        // Find the *next* available question in the main list that hasn't been asked globally
        let replacementQuestion = null;
        // Find the index of the current question in the *original* allQuestions array
        let currentQuestionIndexInAll = allQuestions.findIndex(q => q.id === currentQuestion.id);

        // Start searching from the index *after* the current question's index
        for (let i = currentQuestionIndexInAll + 1; i < allQuestions.length; i++) {
            if (!askedQuestionIds.has(allQuestions[i].id)) {
                replacementQuestion = allQuestions[i];
                break; // Found the next available question
            }
        }

        if (replacementQuestion) {
             console.log(`Found next available question ID ${replacementQuestion.id} for swap.`);
            // --- State Update ---
            currentUser.progress.lifelinesUsed.swapQuestion = true;
            // Mark the *original* question as globally asked so no one gets it again
            askedQuestionIds.add(currentQuestion.id);
            // DO NOT add original question to user's attempted list (they didn't attempt it)
            // DO NOT change currentUser.progress.currentQuestionIndex (user stays at the same level)
            saveUserState(); // Save lifeline use and updated askedQuestionIds
            updateLifelineUI();

            // --- Display Update ---
            console.log(`Swapping Question ID ${currentQuestion.id} with ${replacementQuestion.id}`);
            // Display the replacement question. The global `currentQuestion` will be updated inside displayQuestion.
            displayQuestion(replacementQuestion);
            // The user will now attempt the replacement question at their current level index.
            // When they answer, handleAnswer will use the *new* currentQuestion.
            // If correct, loadNextQuestion will proceed from currentUser.progress.currentQuestionIndex + 1 as usual.

        } else {
            console.log("No suitable swap question found.");
            alert("Could not find an unasked question to swap with. Lifeline not used.");
            // Do not mark lifeline as used if swap failed
        }
    };

    // --- Activate Double Dip (2x) Lifeline ---
    window.activateDoubleDip = () => {
        if (!currentUser || currentUser.progress.lifelinesUsed.doubleDip || !currentQuestion) {
             console.warn("Double Dip activation failed: Preconditions not met.");
             return;
        }
        console.log(`Activating Double Dip for user ${currentUser.name}`);
        currentUser.progress.lifelinesUsed.doubleDip = true;
        doubleDipActive = true; // Activate the state
        doubleDipAttempt = 1; // Reset attempt count
        saveUserState();
        updateLifelineUI();
        alert("Double Dip activated! You have two chances to answer this question.");
        // No visual change needed immediately, logic handled in marking
    };


    window.activateAudiencePoll = () => {
        if (!currentUser || currentUser.progress.lifelinesUsed.audiencePoll || !currentQuestion) return;
        console.log(`Activating Audience Poll for user ${currentUser.name}`);
        currentUser.progress.lifelinesUsed.audiencePoll = true;
        saveUserState();
        updateLifelineUI();

        // 1. Generate QR Code and display modal
        generateQRCode(); // Generates QR in the modal's qrCodeEl
        qrCodeEl.classList.remove('disabled'); // Ensure QR is not disabled initially
        qrExpiredMessageEl.style.display = 'none'; // Hide expired message
        pollModal.style.display = 'block'; // Show the modal
        pollResultsEl.style.display = 'none'; // Hide previous results if any

        // 2. Start 60-second QR code expiry timer
        startPollQrTimer();

        // 3. Polling period starts. Results shown by admin command later.
        console.log("Audience poll QR code displayed. Waiting for votes...");
        // Note: Actual vote collection happens via poll.html, not directly timed here.
        // The timer here is just for QR code visibility/validity on the game screen.
    };

    // --- REMOVED activatePhoneFriend function ---


    // --- Poll QR Code Timer ---
    function startPollQrTimer() {
        clearInterval(pollQrTimerInterval); // Clear existing timer
        pollQrTimeLeft = 60; // Reset timer
        pollQrTimerEl.textContent = pollQrTimeLeft;

        pollQrTimerInterval = setInterval(() => {
            pollQrTimeLeft--;
            pollQrTimerEl.textContent = pollQrTimeLeft;

            if (pollQrTimeLeft <= 0) {
                expirePollQrCode();
            }
        }, 1000);
    }

    function expirePollQrCode() {
        clearInterval(pollQrTimerInterval);
        console.log("Poll QR Code Expired");
        qrCodeEl.classList.add('disabled'); // Visually disable QR code using CSS class
        qrExpiredMessageEl.style.display = 'block'; // Show expired message

        // Automatically close the modal after a short delay
        setTimeout(() => {
            // Check if modal is still open before closing
            if (pollModal.style.display === 'block') {
                pollModal.style.display = 'none';
            }
        }, 3000); // Close after 3 seconds
    }


    // --- QR Code Generation ---
    function generateQRCode() {
        if (!currentQuestion || !currentUser) return; // Need context
        qrCodeEl.innerHTML = ''; // Clear previous QR code
        // Construct URL for poll page, passing necessary info
        const pollUrl = `${window.location.origin}/poll.html?questionId=${currentQuestion.id}&userId=${currentUser.id}`; // Pass user ID too
        console.log("Generating QR for URL:", pollUrl);
        try {
            const qr = qrcode(0, 'M'); // type 0, error correction level M
            qr.addData(pollUrl);
            qr.make();
            qrCodeEl.innerHTML = qr.createImgTag(4); // size 4
        } catch (e) {
            console.error("Error generating QR code:", e);
            qrCodeEl.textContent = 'Error generating QR code.';
        }
    }

    // --- Audience Poll Chart ---
    // This function would be called by the admin panel or after a timeout/event
    window.showPollResults = (pollData = null) => {
        // qrContainerEl.style.display = 'none'; // QR container is inside the other poll modal
        pollModal.style.display = 'none'; // Ensure QR code modal is hidden
        clearInterval(pollQrTimerInterval); // Stop QR timer if results arrive early
        // pollResultsEl.style.display = 'block'; // Don't show the inner div directly

        // Show the poll results modal
        pollResultsModal.style.display = 'block';

        // Simulate poll data if not provided (keep this for testing)
        if (!pollData) {
            pollData = {
                A: Math.floor(Math.random() * 50),
                B: Math.floor(Math.random() * 50),
                C: Math.floor(Math.random() * 50),
                D: Math.floor(Math.random() * 50)
            };
            // Skew towards the correct answer slightly for realism
            const correctAnswer = currentQuestion.correctAnswer;
            pollData[correctAnswer] = Math.floor(Math.random() * 50) + 30; // Add 30-80 votes to correct
        }

        const totalVotes = Object.values(pollData).reduce((sum, votes) => sum + votes, 0);
        const percentages = {
            A: totalVotes === 0 ? 0 : ((pollData.A / totalVotes) * 100).toFixed(1),
            B: totalVotes === 0 ? 0 : ((pollData.B / totalVotes) * 100).toFixed(1),
            C: totalVotes === 0 ? 0 : ((pollData.C / totalVotes) * 100).toFixed(1),
            D: totalVotes === 0 ? 0 : ((pollData.D / totalVotes) * 100).toFixed(1)
        };

        const chartData = {
            labels: ['A', 'B', 'C', 'D'],
            datasets: [{
                label: 'Audience Votes (%)',
                data: [percentages.A, percentages.B, percentages.C, percentages.D],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)', // Blue
                    'rgba(255, 99, 132, 0.6)', // Red
                    'rgba(75, 192, 192, 0.6)', // Green
                    'rgba(255, 206, 86, 0.6)'  // Yellow
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 1
            }]
        };

        if (pollChart) {
            pollChart.destroy(); // Destroy previous chart instance
        }

        pollChart = new Chart(pollChartCanvas, {
            type: 'bar',
            data: chartData,
            options: {
                indexAxis: 'y', // Horizontal bars
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + "%"
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.raw}%`;
                            }
                        }
                    }
                }
            }
        });
    };

    // --- End Game ---
    function endGame(message, status) { // status: 'won', 'quit', 'gameover'
        stopTimer();
        let finalAmount = 0;
        if (currentUser) {
            finalAmount = currentUser.progress.amountWon; // Amount is already calculated before calling endGame
            currentUser.progress.gameStatus = status;
            saveUserState(); // Save final status and amount
            console.log(`Game ended for user ${currentUser.name}. Status: ${status}, Final Amount: ${finalAmount}`);
        }

        // Clear main game area
        questionTextEl.textContent = '';
        optionsGridEl.innerHTML = '';
        timerEl.style.display = 'none'; // Hide timer

        // Populate and show the Game Over modal
        gameOverTitleEl.textContent = (status === 'won') ? "Congratulations!" : "Game Over!";
        gameOverMessageEl.textContent = message; // Use the message passed in
        gameOverAmountEl.textContent = `₹ ${finalAmount.toLocaleString()}`;
        gameOverModal.style.display = 'block';
    }

     // --- Function to manually quit game (called by admin) ---
     window.quitGame = () => {
        if (!currentUser || !currentQuestion) return;
        stopTimer();
        // Amount won is the amount for the *last correctly answered* question's level
        let finalAmount = 0;
        const lastCorrectLevelId = currentUser.progress.currentQuestionIndex - 1; // ID of the level before the current one
        const lastCorrectQuestion = allQuestions.find(q => q.id === lastCorrectLevelId);
        if (lastCorrectQuestion) {
            finalAmount = lastCorrectQuestion.amount;
        }
        // If they quit before answering Q1 correctly, amount is 0.
        currentUser.progress.amountWon = finalAmount;
        endGame(`${currentUser.name} has quit the game, winning ₹${finalAmount.toLocaleString()}.`, 'quit');
     };


    // --- Communication with Admin (Placeholder using LocalStorage) ---
    // Listen for commands from Admin via LocalStorage (basic example)
    window.addEventListener('storage', (event) => {
        if (event.key === 'kbcAdminCommand' && event.newValue) {
             try {
                const command = JSON.parse(event.newValue);
                console.log('Received command from admin:', command);

                // Ensure command is for the current user if applicable
                if (command.userId && currentUser && command.userId !== currentUser.id) {
                    console.log(`Command ignored: User ID mismatch (Command for ${command.userId}, Current is ${currentUser.id})`);
                    return;
                }

                switch (command.action) {
                    case 'startTimer': startTimer(); break;
                    case 'stopTimer': stopTimer(); break;
                    case 'activateFiftyFifty': window.activateFiftyFifty(); break;
                    case 'activateSwapQuestion': window.activateSwapQuestion(); break;
                    case 'activateAudiencePoll': window.activateAudiencePoll(); break;
                    // case 'activatePhoneFriend': window.activatePhoneFriend(); break; // Removed Phone Friend
                    case 'activateDoubleDip': window.activateDoubleDip(); break; // Added Double Dip command
                    case 'showPollResults': window.showPollResults(command.data); break;
                    case 'loadNextQuestion': loadNextQuestion(); break; // Admin triggers next question
                    case 'quitGame': window.quitGame(); break; // Admin triggers quit
                    case 'switchUser':
                        selectUser(command.userId);
                        initializeGame();
                        break;
                    case 'markAnswer': // New command handler
                        handleAdminMarking(command.result); // 'correct' or 'incorrect'
                        break;
                    default:
                        console.warn(`Unknown admin command: ${command.action}`);
                }
            } catch (e) {
                console.error("Error processing admin command:", e);
            }
        }
    });

    // --- Modal Close Button ---
    if (closePollModalBtn) {
        closePollModalBtn.addEventListener('click', () => {
            pollModal.style.display = 'none';
            clearInterval(pollQrTimerInterval); // Stop timer if closed manually
        });
    }

    // Optional: Close modal if clicking outside the content
    window.addEventListener('click', (event) => {
        if (event.target === pollModal) {
            pollModal.style.display = 'none';
            clearInterval(pollQrTimerInterval); // Stop timer if closed manually
        }
    });

    // --- Poll Results Modal Close Button ---
    if (closePollResultsModalBtn) {
        closePollResultsModalBtn.addEventListener('click', () => {
            pollResultsModal.style.display = 'none';
        });
    }

    // --- Game Over Modal Close Button ---
    if (closeGameOverModalBtn) {
        closeGameOverModalBtn.addEventListener('click', () => {
            gameOverModal.style.display = 'none';
            window.close(); // Close the game window
        });
    }


    // --- Handle Admin Marking ---
    function handleAdminMarking(result) { // result is 'correct' or 'incorrect'
        if (!currentUser || !currentQuestion || !selectedOptionElement || !lastSelectedOptionKey) {
            console.error("Cannot mark answer: Missing context (user, question, or selection).");
            return;
        }

        const correctAnswerKey = currentQuestion.correctAnswer;
        const isActuallyCorrect = (lastSelectedOptionKey === correctAnswerKey);

        console.log(`Admin marked answer as: ${result}. Actual correctness: ${isActuallyCorrect}`);

        // Reveal the actual correct answer first
        const correctOptionElement = optionsGridEl.querySelector(`.option[data-option="${correctAnswerKey}"]`);
        if (correctOptionElement) {
            correctOptionElement.classList.add('correct'); // Always show the right one
        }

    // Apply style and sound based on admin's marking *to the selected option*
    // Remove previous marking classes first to handle potential rapid clicks or corrections
    selectedOptionElement.classList.remove('correct', 'wrong');

    if (result === 'correct') {
        selectedOptionElement.classList.add('correct'); // Add green class
        if (correctSound) correctSound.play();
    } else { // result === 'incorrect'
        selectedOptionElement.classList.add('wrong'); // Add red class
        if (wrongSound) wrongSound.play();
    }

    // Now, also ensure the *actual* correct answer is always highlighted green,
    // even if the admin marked the user's selection incorrectly.
    // This might overwrite the selectedOptionElement's class if the user picked the right one
    // but the admin marked it wrong, which seems desirable for clarity.
    if (correctOptionElement && correctOptionElement !== selectedOptionElement) {
        correctOptionElement.classList.remove('wrong'); // Ensure it's not marked wrong
        correctOptionElement.classList.add('correct'); // Ensure it's marked correct
    }

        disableOptions(); // Disable options after marking

        // Update game state based on *actual* correctness
        if (isActuallyCorrect) {
            currentUser.progress.amountWon = currentQuestion.amount;
            currentUser.progress.gameStatus = 'active'; // Still playing
            saveUserState();
            updateMoneyTree(currentQuestion.id, true); // Update money tree showing correct
            console.log(`Marked Correct! User ${currentUser.name} won ${currentUser.progress.amountWon}. Waiting for admin to load next question.`);
            // Reset Double Dip state if it was active and correct answer given
            doubleDipActive = false;
            doubleDipAttempt = 1;
        } else { // Incorrect Answer or Time Up
             if (wrongSound) wrongSound.play(); // Play wrong sound even on first DD attempt

            if (doubleDipActive && doubleDipAttempt === 1) {
                // First incorrect attempt with Double Dip active
                console.log("Double Dip: First attempt incorrect. Allowing second chance.");
                doubleDipAttempt = 2; // Move to second attempt
                // Visually disable the wrong option chosen
                if (selectedOptionElement) {
                    selectedOptionElement.classList.add('wrong-disabled'); // Add a class to style it (e.g., greyed out, strike-through)
                    selectedOptionElement.style.cursor = 'default';
                    selectedOptionElement.removeEventListener('click', handleOptionClick); // Ensure it's not clickable
                }
                // Re-enable other options (except the one just chosen)
                optionsGridEl.querySelectorAll('.option').forEach(opt => {
                    if (opt !== selectedOptionElement && !opt.classList.contains('wrong-disabled')) { // Check if not already disabled by 50:50 etc.
                        opt.addEventListener('click', handleOptionClick);
                        opt.style.cursor = 'pointer';
                        opt.style.backgroundColor = ''; // Reset selection highlight
                    }
                });
                alert("That was incorrect. You have one more chance with Double Dip!");
                // Reset selection tracking for the second attempt
                selectedOptionElement = null;
                lastSelectedOptionKey = null;
                // DO NOT end the game here, wait for second attempt or admin action
            } else {
                // Second incorrect attempt with Double Dip OR normal incorrect answer OR time up
                if (doubleDipActive) {
                    console.log("Double Dip: Second attempt incorrect.");
                }
                // Find the safe milestone amount
                let finalAmount = 0;
                for (let i = allQuestions.length - 1; i >= 0; i--) {
                const q = allQuestions[i];
                if (q.milestone && q.id < currentQuestion.id) {
                    finalAmount = q.amount;
                    break;
                }
                }
                currentUser.progress.amountWon = finalAmount;
                updateMoneyTree(currentQuestion.id, false); // Update money tree showing incorrect/current level
                endGame(`Sorry, that was incorrect. ${currentUser.name} walks away with ₹${finalAmount.toLocaleString()}.`, 'gameover');
                // Reset Double Dip state after game ends
                doubleDipActive = false;
                doubleDipAttempt = 1;
            }
        }

        // Reset selection tracking for the next question (only if not waiting for 2nd DD attempt)
        if (!doubleDipActive || doubleDipAttempt !== 2) {
             selectedOptionElement = null;
             lastSelectedOptionKey = null;
        }
    }


    // --- Initial Load ---
    fetchData(); // Fetch both questions and users

});
