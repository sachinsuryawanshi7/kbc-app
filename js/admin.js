document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startQuestionBtn = document.getElementById('start-question');
    const startTimerBtn = document.getElementById('start-timer');
    const stopTimerBtn = document.getElementById('stop-timer');
    const markCorrectBtn = document.getElementById('mark-correct');
    const markIncorrectBtn = document.getElementById('mark-incorrect');
    const generateQrBtn = document.getElementById('generate-qr'); // For audience poll
    const showPollResultsBtn = document.getElementById('show-poll-results');
    const resetQuestionBtn = document.getElementById('reset-question');
    const toggleGameScreenBtn = document.getElementById('toggle-game-screen');

    const adminQuestionTextEl = document.getElementById('admin-question-text');
    const adminOptionsEl = document.getElementById('admin-options');
    const correctAnswerEl = document.getElementById('correct-answer');
    const selectedAnswerEl = document.getElementById('selected-answer'); // To show player's selection
    const adminPollResultsEl = document.getElementById('admin-poll-results');
    const adminPollChartCanvas = document.getElementById('admin-poll-chart');

    const activateFiftyFiftyBtn = document.getElementById('activate-fifty-fifty');
    const activateSwapBtn = document.getElementById('activate-swap');
    const activateAudiencePollBtn = document.getElementById('activate-audience-poll');
    const activatePhoneFriendBtn = document.getElementById('activate-phone-friend');

    const prevQuestionBtn = document.getElementById('prev-question');
    const nextQuestionBtn = document.getElementById('next-question');
    const questionSelectEl = document.getElementById('question-select');
    const adminMoneyLevelsEl = document.getElementById('admin-money-levels');
    const darkModeToggle = document.getElementById('dark-mode-toggle-admin');
    const body = document.body;

    // Game State (mirrored or controlled from admin)
    let questions = [];
    let currentQuestionIndex = 0;
    let currentQuestion = null;
    let gameScreenWindow = null; // To hold reference to the game screen window
    let adminPollChart = null;
    let audiencePollData = {}; // Store votes received from poll.html

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

    // --- Fetch Questions ---
    async function fetchQuestions() {
        try {
            const response = await fetch('data/questions.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            questions = data.questions;
            console.log('Admin: Questions loaded:', questions);
            populateQuestionSelector();
            updateAdminMoneyTree();
            loadQuestionForAdmin(currentQuestionIndex);
        } catch (error) {
            console.error("Admin: Could not fetch questions:", error);
            adminQuestionTextEl.textContent = 'Error loading questions.';
        }
    }

    // --- Populate Question Selector ---
    function populateQuestionSelector() {
        questionSelectEl.innerHTML = ''; // Clear existing options
        questions.forEach((q, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Q ${q.id}: ${q.question.substring(0, 30)}... (₹${q.amount.toLocaleString()})`;
            questionSelectEl.appendChild(option);
        });
        questionSelectEl.value = currentQuestionIndex; // Set initial value
    }

    // --- Load Question for Admin View ---
    function loadQuestionForAdmin(index) {
        if (index < 0 || index >= questions.length) return;
        
        currentQuestionIndex = index;
        currentQuestion = questions[index];
        questionSelectEl.value = index; // Sync dropdown

        adminQuestionTextEl.textContent = `Q${currentQuestion.id}: ${currentQuestion.question}`;
        correctAnswerEl.textContent = currentQuestion.correctAnswer;
        selectedAnswerEl.textContent = 'None'; // Reset selected answer display
        adminOptionsEl.innerHTML = ''; // Clear previous options

        ['A', 'B', 'C', 'D'].forEach(key => {
            const optionDiv = document.createElement('div');
            optionDiv.classList.add('admin-option'); // Use admin-specific class if needed
            optionDiv.dataset.option = key;

            const letterSpan = document.createElement('span');
            letterSpan.classList.add('option-letter');
            letterSpan.textContent = key;

            const textSpan = document.createElement('span');
            textSpan.classList.add('option-text');
            textSpan.textContent = currentQuestion.options[key];

            optionDiv.appendChild(letterSpan);
            optionDiv.appendChild(textSpan);

            if (key === currentQuestion.correctAnswer) {
                optionDiv.style.fontWeight = 'bold'; // Highlight correct answer for admin
                optionDiv.style.borderLeft = '3px solid var(--correct-answer)';
            }
            adminOptionsEl.appendChild(optionDiv);
        });

        // Reset poll display for the new question
        adminPollResultsEl.style.display = 'none';
        if (adminPollChart) {
            adminPollChart.destroy();
            adminPollChart = null;
        }
        audiencePollData = {}; // Clear old poll data

        // Send command to game screen to load the same question
        sendCommandToGame({ action: 'loadQuestion', index: currentQuestionIndex });
        updateAdminMoneyTree(currentQuestion.id);
    }

    // --- Send Command to Game Screen ---
    function sendCommandToGame(command) {
        console.log('Admin sending command:', command);
        // Use LocalStorage for basic communication
        localStorage.setItem('kbcAdminCommand', JSON.stringify({ ...command, timestamp: Date.now() }));

        // If using window.open, you could try direct function calls (less reliable)
        // if (gameScreenWindow && !gameScreenWindow.closed && gameScreenWindow[command.action]) {
        //     try {
        //         gameScreenWindow[command.action](command.data);
        //     } catch (e) {
        //         console.error("Error calling function on game window:", e);
        //     }
        // }
    }

    // --- Admin Money Tree ---
    function updateAdminMoneyTree(currentLevelId = 0) {
        adminMoneyLevelsEl.innerHTML = ''; // Clear previous levels
        questions.slice().reverse().forEach(level => {
            const levelDiv = document.createElement('div');
            levelDiv.classList.add('money-level'); // Reuse game screen style
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
             // Add click listener to jump to question
            levelDiv.style.cursor = 'pointer';
            levelDiv.addEventListener('click', () => {
                const index = questions.findIndex(q => q.id === level.id);
                if (index !== -1) {
                    loadQuestionForAdmin(index);
                }
            });

            adminMoneyLevelsEl.appendChild(levelDiv);
        });
    }

    // --- Event Listeners for Controls ---
    startQuestionBtn.addEventListener('click', () => {
        // This might just involve loading the question visually if not already done
        loadQuestionForAdmin(currentQuestionIndex);
        // Optionally send a 'displayQuestion' command if needed
    });

    startTimerBtn.addEventListener('click', () => sendCommandToGame({ action: 'startTimer' }));
    stopTimerBtn.addEventListener('click', () => sendCommandToGame({ action: 'stopTimer' }));
    markCorrectBtn.addEventListener('click', () => sendCommandToGame({ action: 'markCorrect' }));
    markIncorrectBtn.addEventListener('click', () => sendCommandToGame({ action: 'markIncorrect' })); // Game.js needs player selection info

    generateQrBtn.addEventListener('click', () => {
        sendCommandToGame({ action: 'activateAudiencePoll' }); // Tell game screen to show QR
        // Admin might also need to start a timer for polling duration here
    });

    showPollResultsBtn.addEventListener('click', () => {
        // Fetch results (from localStorage, WebSocket, etc.) and display locally & on game screen
        displayAdminPollResults(audiencePollData); // Display on admin panel
        sendCommandToGame({ action: 'showPollResults', data: audiencePollData }); // Send to game screen
    });

    resetQuestionBtn.addEventListener('click', () => {
        // Reload the current question state on both screens
        loadQuestionForAdmin(currentQuestionIndex);
    });

    toggleGameScreenBtn.addEventListener('click', () => {
        if (gameScreenWindow && !gameScreenWindow.closed) {
            gameScreenWindow.focus();
        } else {
            gameScreenWindow = window.open('game.html', 'KBCGameScreen', 'width=1200,height=800');
        }
    });

    // Lifeline Activation Buttons
    activateFiftyFiftyBtn.addEventListener('click', () => sendCommandToGame({ action: 'activateFiftyFifty' }));
    activateSwapBtn.addEventListener('click', () => sendCommandToGame({ action: 'activateSwapQuestion' }));
    activateAudiencePollBtn.addEventListener('click', () => sendCommandToGame({ action: 'activateAudiencePoll' }));
    activatePhoneFriendBtn.addEventListener('click', () => sendCommandToGame({ action: 'activatePhoneFriend' }));

    // Navigation Buttons
    prevQuestionBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            loadQuestionForAdmin(currentQuestionIndex - 1);
        }
    });

    nextQuestionBtn.addEventListener('click', () => {
        if (currentQuestionIndex < questions.length - 1) {
            loadQuestionForAdmin(currentQuestionIndex + 1);
        }
    });

    questionSelectEl.addEventListener('change', (event) => {
        const index = parseInt(event.target.value, 10);
        loadQuestionForAdmin(index);
    });

    // --- Listen for Game State Updates (via LocalStorage) ---
    window.addEventListener('storage', (event) => {
        if (event.key === 'kbcGameState') { // Updates from game.js
            const state = JSON.parse(event.newValue);
            console.log('Admin received game state update:', state);
            // Update admin UI based on game state if needed
            // e.g., update selected answer, score, lifelines used display
            if (state.selectedOptionKey) {
                 selectedAnswerEl.textContent = state.selectedOptionKey;
            }
             // Reflect lifeline usage on admin buttons (optional)
             // updateAdminLifelineButtons(state.lifelinesUsed);
        }
        if (event.key === 'kbcPollVote') { // Votes from poll.js
            const voteData = JSON.parse(event.newValue);
             console.log('Admin received poll vote:', voteData);
            if (voteData.questionId === currentQuestion.id) {
                const voteOption = voteData.option;
                audiencePollData[voteOption] = (audiencePollData[voteOption] || 0) + 1;
                // Optionally update admin poll chart in real-time (can be resource intensive)
                // displayAdminPollResults(audiencePollData); 
            }
        }
    });

     // --- Display Admin Poll Results ---
    function displayAdminPollResults(pollData) {
        adminPollResultsEl.style.display = 'block';
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
                 backgroundColor: [ /* Colors as in game.js */
                    'rgba(54, 162, 235, 0.6)', 'rgba(255, 99, 132, 0.6)',
                    'rgba(75, 192, 192, 0.6)', 'rgba(255, 206, 86, 0.6)'
                ],
                borderColor: [ /* Border colors as in game.js */
                    'rgba(54, 162, 235, 1)', 'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)', 'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 1
            }]
        };

        if (adminPollChart) {
            adminPollChart.destroy();
        }

        adminPollChart = new Chart(adminPollChartCanvas, {
            type: 'bar',
            data: chartData,
            options: { /* Options as in game.js */
                indexAxis: 'y',
                scales: { x: { beginAtZero: true, max: 100, ticks: { callback: value => value + "%" } } },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => ` ${context.raw}%` } } }
            }
        });
    }


    // --- Initial Load ---
    fetchQuestions();
});
