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
        phoneFriend: document.getElementById('phone-friend') // Assuming this is the 4th lifeline
    };
    const qrContainerEl = document.getElementById('qr-container');
    const qrCodeEl = document.getElementById('qr-code');
    const pollResultsEl = document.getElementById('poll-results');
    const pollChartCanvas = document.getElementById('poll-chart');
    const darkModeToggle = document.getElementById('dark-mode-toggle-game');
    const body = document.body;

    // Game State
    let questions = [];
    let currentQuestionIndex = 0;
    let currentQuestion = null;
    let score = 0;
    let timerInterval = null;
    let timeLeft = 60;
    let lifelinesUsed = {
        fiftyFifty: false,
        swapQuestion: false,
        audiencePoll: false,
        phoneFriend: false
    };
    let pollChart = null;

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

    // --- Fetch Questions ---
    async function fetchQuestions() {
        try {
            const response = await fetch('data/questions.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            questions = data.questions;
            console.log('Questions loaded:', questions);
            initializeGame();
        } catch (error) {
            console.error("Could not fetch questions:", error);
            questionTextEl.textContent = 'Error loading questions. Please try again later.';
        }
    }

    // --- Initialize Game ---
    function initializeGame() {
        if (questions.length === 0) return;
        currentQuestionIndex = 0;
        score = 0;
        lifelinesUsed = { fiftyFifty: false, swapQuestion: false, audiencePoll: false, phoneFriend: false };
        updateMoneyTree();
        updateLifelineUI();
        loadQuestion(currentQuestionIndex);
    }

    // --- Load Question ---
    function loadQuestion(index) {
        if (index >= questions.length) {
            endGame("Congratulations! You've answered all questions!");
            return;
        }
        currentQuestion = questions[index];
        questionNumberEl.textContent = currentQuestion.id;
        questionTextEl.textContent = currentQuestion.question;
        optionsGridEl.innerHTML = ''; // Clear previous options

        // Reset styles and visibility
        qrContainerEl.style.display = 'none';
        pollResultsEl.style.display = 'none';
        if (pollChart) {
            pollChart.destroy();
            pollChart = null;
        }

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
            optionDiv.addEventListener('click', handleOptionClick);
            optionsGridEl.appendChild(optionDiv);
        });

        updateMoneyTree(currentQuestion.id);
        resetTimer();
        // Timer should ideally be started by admin action, but we'll start it here for now
        // startTimer(); 
    }

    // --- Timer ---
    function startTimer() {
        clearInterval(timerInterval); // Clear any existing timer
        timeLeft = 60;
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
                handleAnswer(null); // Time's up
                timerEl.classList.remove('pulse');
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerEl.classList.remove('pulse');
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
        const selectedOptionElement = event.currentTarget;
        const selectedOptionKey = selectedOptionElement.dataset.option;

        // Disable further clicks
        disableOptions();

        // Add visual feedback (e.g., highlight selected) - Optional
        selectedOptionElement.style.backgroundColor = 'orange'; // Temporary selection indicator

        // Simulate thinking time before revealing result
        setTimeout(() => {
            handleAnswer(selectedOptionKey, selectedOptionElement);
        }, 2000); // 2 seconds delay
    }

    function handleAnswer(selectedOptionKey, selectedElement) {
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
            score = currentQuestion.amount;
            // Play correct sound effect (optional)
            console.log("Correct Answer!");
            setTimeout(() => {
                currentQuestionIndex++;
                loadQuestion(currentQuestionIndex);
            }, 3000); // Wait 3 seconds before loading next question
        } else {
            // Play wrong sound effect (optional)
            console.log("Wrong Answer!");
            // Find the safe milestone amount
            let finalAmount = 0;
            for (let i = currentQuestionIndex - 1; i >= 0; i--) {
                if (questions[i].milestone) {
                    finalAmount = questions[i].amount;
                    break;
                }
            }
            endGame(`Sorry, that was incorrect. You walk away with ₹${finalAmount.toLocaleString()}.`);
        }
        updateMoneyTree(currentQuestion.id, selectedOptionKey === correctAnswer);
    }

    function disableOptions() {
        optionsGridEl.querySelectorAll('.option').forEach(opt => {
            opt.removeEventListener('click', handleOptionClick);
            opt.style.cursor = 'not-allowed';
            // opt.classList.add('disabled'); // Optional: Add disabled class for styling
        });
    }

    // --- Money Tree ---
    function updateMoneyTree(currentLevelId = 0, isCorrect = null) {
        moneyLevelsEl.innerHTML = ''; // Clear previous levels
        questions.slice().reverse().forEach(level => { // Iterate reversed for correct display order
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
            if (level.id === currentLevelId) {
                levelDiv.classList.add('current');
            }
            // Highlight past correct answers (optional)
            if (level.id < currentLevelId) {
                 levelDiv.style.opacity = '0.7';
                 levelDiv.style.backgroundColor = 'var(--correct-answer)'; // Or a lighter shade
                 levelDiv.style.color = 'var(--light-text)';
            }

            moneyLevelsEl.appendChild(levelDiv);
        });
    }

    // --- Lifelines ---
    function updateLifelineUI() {
        for (const key in lifelines) {
            if (lifelinesUsed[key]) {
                lifelines[key].classList.add('used');
                lifelines[key].removeEventListener('click', handleLifelineClick); // Prevent re-use
            } else {
                lifelines[key].classList.remove('used');
                lifelines[key].addEventListener('click', handleLifelineClick);
            }
        }
    }

    function handleLifelineClick(event) {
        const lifelineId = event.currentTarget.id;

        if (lifelinesUsed[lifelineId]) return; // Already used

        // Lifeline logic will be triggered by admin, this is just placeholder
        console.log(`Lifeline clicked: ${lifelineId}`);
        // Example: Visually mark as used immediately (though actual use is admin-controlled)
        // lifelinesUsed[lifelineId] = true;
        // updateLifelineUI();

        // Send request to admin panel or use shared state (e.g., LocalStorage/WebSocket)
        // For now, we assume admin triggers the actual effect
        alert(`Lifeline ${lifelineId} requested. Waiting for admin activation.`);
    }

    // --- Lifeline Effects (To be triggered by Admin) ---
    window.activateFiftyFifty = () => {
        if (lifelinesUsed.fiftyFifty || !currentQuestion) return;
        console.log("Activating 50:50");
        lifelinesUsed.fiftyFifty = true;
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

    window.activateSwapQuestion = () => {
        if (lifelinesUsed.swapQuestion || !currentQuestion) return;
        console.log("Activating Swap Question");
        lifelinesUsed.swapQuestion = true;
        updateLifelineUI();

        // Find a replacement question (simple approach: find next unused)
        // A more robust approach would involve a separate pool of swap questions
        let nextIndex = -1;
        for (let i = 0; i < questions.length; i++) {
            // Check if question 'i' is not the current one and hasn't been used as a swap target before
            if (i !== currentQuestionIndex && !questions[i].swapped) {
                 // Basic check: ensure it's not the same question ID
                 if (questions[i].id !== currentQuestion.id) {
                    nextIndex = i;
                    break;
                 }
            }
        }

        if (nextIndex !== -1) {
            // Mark the original question so it's not picked again if swapping happens multiple times
            questions[currentQuestionIndex].swapped = true; 
            // Mark the new question as used in swap to avoid loops
            questions[nextIndex].swapped = true; 
            
            currentQuestionIndex = nextIndex; // Update the index
            loadQuestion(currentQuestionIndex); // Load the new question
            console.log(`Swapped to question ID: ${questions[nextIndex].id}`);
        } else {
            console.log("No suitable swap question found.");
            // Optionally re-enable the lifeline button or show a message
            lifelinesUsed.swapQuestion = false; // Allow retry if no swap found?
            updateLifelineUI();
            alert("Could not find a question to swap with.");
        }
    };

    window.activateAudiencePoll = () => {
        if (lifelinesUsed.audiencePoll || !currentQuestion) return;
        console.log("Activating Audience Poll");
        lifelinesUsed.audiencePoll = true;
        updateLifelineUI();

        // 1. Generate QR Code
        generateQRCode();
        qrContainerEl.style.display = 'block';
        pollResultsEl.style.display = 'none'; // Hide previous results if any

        // 2. Start polling period (Admin might control this duration)
        console.log("Audience poll started. Waiting for votes...");
        // 3. After polling (e.g., 60 seconds or admin trigger), show results
        // This part needs coordination with the admin panel and potentially a backend/WebSocket
        // For now, simulate receiving results after a delay
        // setTimeout(showPollResults, 10000); // Simulate showing results after 10s
    };
    
    window.activatePhoneFriend = () => {
        if (lifelinesUsed.phoneFriend || !currentQuestion) return;
        console.log("Activating Phone a Friend");
        lifelinesUsed.phoneFriend = true;
        updateLifelineUI();
        // Logic for phone a friend (e.g., start a separate timer, display a message)
        alert("Phone a Friend activated. You have 30 seconds!");
        // Start a 30-second timer specific to this lifeline (visual only for now)
    };

    // --- QR Code Generation ---
    function generateQRCode() {
        qrCodeEl.innerHTML = ''; // Clear previous QR code
        const pollUrl = `${window.location.origin}/poll.html?questionId=${currentQuestion.id}`; // URL for audience to vote
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
    // This function would be called by the admin panel or after a timeout
    window.showPollResults = (pollData = null) => {
        qrContainerEl.style.display = 'none'; // Hide QR code
        pollResultsEl.style.display = 'block';

        // Simulate poll data if not provided
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
    function endGame(message) {
        stopTimer();
        questionTextEl.textContent = message;
        optionsGridEl.innerHTML = ''; // Clear options
        // Maybe show a final score or restart button
    }

    // --- Communication with Admin (Placeholder using LocalStorage) ---
    // This is a basic way to communicate state. WebSockets would be better.
    function updateAdminState() {
        const state = {
            currentQuestionIndex: currentQuestionIndex,
            score: score,
            lifelinesUsed: lifelinesUsed,
            timeLeft: timeLeft,
            // Add other relevant state info
        };
        localStorage.setItem('kbcGameState', JSON.stringify(state));
    }

    // Listen for commands from Admin via LocalStorage (basic example)
    window.addEventListener('storage', (event) => {
        if (event.key === 'kbcAdminCommand') {
            const command = JSON.parse(event.newValue);
            console.log('Received command from admin:', command);

            if (command.action === 'startTimer') startTimer();
            if (command.action === 'stopTimer') stopTimer();
            if (command.action === 'activateFiftyFifty') window.activateFiftyFifty();
            if (command.action === 'activateSwapQuestion') window.activateSwapQuestion();
            if (command.action === 'activateAudiencePoll') window.activateAudiencePoll();
            if (command.action === 'activatePhoneFriend') window.activatePhoneFriend();
            if (command.action === 'showPollResults') window.showPollResults(command.data);
            if (command.action === 'loadQuestion') {
                 currentQuestionIndex = command.index;
                 loadQuestion(currentQuestionIndex);
            }
            if (command.action === 'markCorrect') {
                 // Find the selected option visually (if needed) or just process
                 handleAnswer(currentQuestion.correctAnswer);
            }
             if (command.action === 'markIncorrect') {
                 // Need to know which option was selected by player
                 // This requires player interaction first, or admin forcing an outcome
                 // For now, assume player already selected, admin confirms wrong
                 const playerSelectedOption = prompt("Admin: Enter the option player selected (A/B/C/D):"); // Very basic
                 if (playerSelectedOption && playerSelectedOption !== currentQuestion.correctAnswer) {
                    handleAnswer(playerSelectedOption);
                 } else {
                    alert("Invalid input or player selected correctly.");
                 }
            }
            // Add more command handlers as needed
        }
    });

    // --- Initial Load ---
    fetchQuestions();

});
