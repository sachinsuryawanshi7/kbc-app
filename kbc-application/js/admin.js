document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    // --- User Selection ---
    const userSelectEl = document.getElementById('user-select');
    const userStatusEl = document.getElementById('user-status');

    // --- Game Controls ---
    const loadNextQuestionBtn = document.getElementById('load-next-question');
    const startTimerBtn = document.getElementById('start-timer');
    const stopTimerBtn = document.getElementById('stop-timer');
    const quitGameBtn = document.getElementById('quit-game');
    const showPollResultsBtn = document.getElementById('show-poll-results');
    const toggleGameScreenBtn = document.getElementById('toggle-game-screen');

    // --- Question Display ---
    const adminQuestionTextEl = document.getElementById('admin-question-text');
    const adminOptionsEl = document.getElementById('admin-options');
    const correctAnswerEl = document.getElementById('correct-answer');
    const selectedAnswerEl = document.getElementById('selected-answer');
    const adminPollResultsEl = document.getElementById('admin-poll-results');
    const adminPollChartCanvas = document.getElementById('admin-poll-chart');
    const markCorrectBtn = document.getElementById('mark-correct'); // New
    const markIncorrectBtn = document.getElementById('mark-incorrect'); // New

    // --- Lifeline Controls ---
    const lifelineButtons = document.querySelectorAll('.lifeline-btn'); // Select all lifeline buttons

    // --- Info/Viewer ---
    const questionViewSelectEl = document.getElementById('question-view-select');
    const viewQuestionDetailsBtn = document.getElementById('view-question-details');
    const adminMoneyLevelsEl = document.getElementById('admin-money-levels');

    // --- General ---
    const darkModeToggle = document.getElementById('dark-mode-toggle-admin');
    const body = document.body;

    // Admin Panel State
    let allQuestions = []; // Renamed from questions
    let users = [];
    let adminCurrentUser = null; // The user selected in the admin panel
    let adminCurrentQuestion = null; // The question currently displayed in the admin panel (might differ from game screen)
    let askedQuestionIds = new Set(); // Track asked questions globally, synced from game.js updates
    let gameScreenWindow = null;
    let adminPollChart = null;
    let audiencePollData = {}; // Store votes for the current question being polled

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

    // --- Fetch Data (Questions and Users) ---
    async function fetchData() {
        try {
            const [questionsResponse, usersResponse] = await Promise.all([
                fetch('data/questions.json'),
                fetch('data/users.json')
            ]);

            if (!questionsResponse.ok) throw new Error(`HTTP error! Questions status: ${questionsResponse.status}`);
            if (!usersResponse.ok) throw new Error(`HTTP error! Users status: ${usersResponse.status}`);

            const questionsData = await questionsResponse.json();
            const usersData = await usersResponse.json();

            allQuestions = questionsData.questions;
            users = usersData;
            console.log('Admin: Questions loaded:', allQuestions);
            console.log('Admin: Users loaded:', users);

            // Populate selectors
            populateUserSelector();
            populateQuestionViewerSelector(); // Populate the viewer dropdown
            updateAdminMoneyTree(); // Initial money tree display

            // Select the first user by default
            if (users.length > 0) {
                selectUser(users[0].id); // This will trigger UI updates and command
            } else {
                userStatusEl.textContent = "No users found.";
            }

        } catch (error) {
            console.error("Admin: Could not fetch data:", error);
            adminQuestionTextEl.textContent = 'Error loading game data.';
        }
    }

    // --- Populate User Selector ---
    function populateUserSelector() {
        userSelectEl.innerHTML = ''; // Clear existing options
        if (users.length === 0) {
            userSelectEl.innerHTML = '<option value="">No Users</option>';
            return;
        }
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (ID: ${user.id})`;
            userSelectEl.appendChild(option);
        });
    }

    // --- Populate Question Viewer Selector ---
    function populateQuestionViewerSelector() {
        questionViewSelectEl.innerHTML = ''; // Clear existing options
        allQuestions.forEach((q) => {
            const option = document.createElement('option');
            option.value = q.id; // Use question ID as value
            option.textContent = `Q ${q.id}: ${q.question.substring(0, 30)}...`;
            questionViewSelectEl.appendChild(option);
        });
    }

    // --- Handle User Selection ---
    function selectUser(userId) {
        const selectedUserId = parseInt(userId, 10);
        adminCurrentUser = users.find(u => u.id === selectedUserId);

        if (adminCurrentUser) {
            console.log(`Admin: Selected user ${adminCurrentUser.name}`);
            userSelectEl.value = adminCurrentUser.id; // Sync dropdown
            updateAdminUIForUser(); // Update status, lifelines etc.

            // Command game screen to switch user
            sendCommandToGame({ action: 'switchUser', userId: adminCurrentUser.id });

            // Load the question the user is currently on (or should be on) into admin view
            loadQuestionForAdminView(adminCurrentUser.progress.currentQuestionIndex);

        } else {
            console.error(`Admin: User with ID ${selectedUserId} not found.`);
            adminCurrentUser = null;
            // Clear admin UI or show default state
            clearAdminQuestionView();
            userStatusEl.textContent = "Select a user";
            updateAdminLifelineButtons(null); // Disable lifelines
        }
    }

    // --- Update Admin UI based on Selected User ---
    function updateAdminUIForUser() {
        if (!adminCurrentUser) return;

        // Update Status Display
        userStatusEl.textContent = `Status: ${adminCurrentUser.progress.gameStatus} | Won: ₹${adminCurrentUser.progress.amountWon.toLocaleString()}`;

        // Update Lifeline Buttons
        updateAdminLifelineButtons(adminCurrentUser.progress.lifelinesUsed);

        // Update Money Tree Highlight
        updateAdminMoneyTree(adminCurrentUser.progress.currentQuestionIndex);

        // Update Admin Question View to user's current question
        loadQuestionForAdminView(adminCurrentUser.progress.currentQuestionIndex);
    }

    // --- Update Admin Lifeline Buttons ---
    function updateAdminLifelineButtons(lifelinesUsed) {
        lifelineButtons.forEach(btn => {
            const lifelineKey = btn.dataset.lifeline; // e.g., fiftyFifty
            if (lifelinesUsed && lifelinesUsed[lifelineKey]) {
                btn.disabled = true;
                btn.classList.add('used'); // Add 'used' style
            } else {
                btn.disabled = false;
                btn.classList.remove('used');
            }
        });
         // Disable all if no user selected
         if (!lifelinesUsed) {
             lifelineButtons.forEach(btn => btn.disabled = true);
         }
    }


    // --- Load Question for Admin VIEW ONLY ---
    // Renamed from loadQuestionForAdmin to avoid confusion
    function loadQuestionForAdminView(questionId) {
        // Find question by ID, not index
        const questionToShow = allQuestions.find(q => q.id === questionId);

        if (!questionToShow) {
            // If user's index points to a non-existent question (e.g., game start index 0)
            // or if they finished, clear the view.
            if (questionId > 0 && adminCurrentUser && adminCurrentUser.progress.gameStatus !== 'ready') {
                 console.log(`Admin View: User ${adminCurrentUser.name} is likely between questions or finished.`);
                 // Optionally show the last answered question or a message
                 const lastAttemptedId = Math.max(0, ...adminCurrentUser.progress.questionsAttempted);
                 const lastQuestion = allQuestions.find(q => q.id === lastAttemptedId);
                 if(lastQuestion) displayQuestionDetails(lastQuestion);
                 else clearAdminQuestionView();

            } else {
                 clearAdminQuestionView();
            }
            return;
        }

        adminCurrentQuestion = questionToShow; // Update admin's current question view
        displayQuestionDetails(adminCurrentQuestion); // Update the UI elements
        updateAdminMoneyTree(adminCurrentQuestion.id); // Highlight level in admin money tree
    }

    // --- Helper to display question details in admin panel ---
    function displayQuestionDetails(question) {
         adminQuestionTextEl.textContent = `Q${question.id}: ${question.question}`;
         correctAnswerEl.textContent = question.correctAnswer;
         selectedAnswerEl.textContent = 'None'; // Reset selected answer display for view
         adminOptionsEl.innerHTML = ''; // Clear previous options

         ['A', 'B', 'C', 'D'].forEach(key => {
             const optionDiv = document.createElement('div');
             optionDiv.classList.add('admin-option');
             optionDiv.dataset.option = key;

             const letterSpan = document.createElement('span');
             letterSpan.classList.add('option-letter');
             letterSpan.textContent = key;

             const textSpan = document.createElement('span');
             textSpan.classList.add('option-text');
             textSpan.textContent = question.options[key];

             optionDiv.appendChild(letterSpan);
             optionDiv.appendChild(textSpan);

             if (key === question.correctAnswer) {
                 optionDiv.style.fontWeight = 'bold';
                 optionDiv.style.borderLeft = '3px solid var(--correct-answer)';
             }
             adminOptionsEl.appendChild(optionDiv);
         });

         // Reset poll display when viewing a question
         adminPollResultsEl.style.display = 'none';
         if (adminPollChart) {
             adminPollChart.destroy();
             adminPollChart = null;
         }
         audiencePollData = {}; // Clear poll data for viewed question
    }

     // --- Helper to clear the admin question display ---
     function clearAdminQuestionView() {
        adminQuestionTextEl.textContent = 'No question loaded or user not active.';
        correctAnswerEl.textContent = '-';
        selectedAnswerEl.textContent = 'None';
        adminOptionsEl.innerHTML = '';
        adminCurrentQuestion = null;
     }


    // --- Send Command to Game Screen (Add User ID) ---
    function sendCommandToGame(command) {
        if (!adminCurrentUser && command.action !== 'switchUser') {
            console.warn("Admin: No user selected, cannot send command:", command.action);
            alert("Please select an active participant first.");
            return;
        }
        // Add userId to commands that are user-specific
        const commandToSend = {
            ...command,
            userId: adminCurrentUser ? adminCurrentUser.id : null, // Include user ID
            timestamp: Date.now()
        };
        console.log('Admin sending command:', commandToSend);
        localStorage.setItem('kbcAdminCommand', JSON.stringify(commandToSend));

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
    function updateAdminMoneyTree(highlightLevelId = 0) {
        adminMoneyLevelsEl.innerHTML = ''; // Clear previous levels
        if (allQuestions.length === 0) return;

        allQuestions.slice().reverse().forEach(level => {
            const levelDiv = document.createElement('div');
            levelDiv.classList.add('money-level'); // Reuse game screen style
            levelDiv.dataset.levelId = level.id; // Use ID for dataset

            const levelNumberSpan = document.createElement('span');
            levelNumberSpan.textContent = `${level.id}.`; // Display ID
            levelNumberSpan.style.marginRight = '10px';

            const levelAmountSpan = document.createElement('span');
            levelAmountSpan.textContent = `₹ ${level.amount.toLocaleString()}`;

            levelDiv.appendChild(levelNumberSpan);
            levelDiv.appendChild(levelAmountSpan);

            if (level.milestone) {
                levelDiv.classList.add('milestone');
            }
            // Highlight based on the passed ID (usually user's current level)
            if (level.id === highlightLevelId) {
                levelDiv.classList.add('current');
            }
            // Make levels clickable to view details in admin panel
            levelDiv.style.cursor = 'pointer';
            levelDiv.addEventListener('click', () => {
                 // Find the question by ID and display its details
                 const questionToView = allQuestions.find(q => q.id === level.id);
                 if (questionToView) {
                     displayQuestionDetails(questionToView);
                     questionViewSelectEl.value = level.id; // Sync viewer dropdown
                 }
            });

            adminMoneyLevelsEl.appendChild(levelDiv);
        });
    }

    // --- Event Listeners for Controls ---

    // User Selection
    userSelectEl.addEventListener('change', (event) => {
        selectUser(event.target.value);
    });

    // Game Flow Controls
    loadNextQuestionBtn.addEventListener('click', () => sendCommandToGame({ action: 'loadNextQuestion' }));
    startTimerBtn.addEventListener('click', () => sendCommandToGame({ action: 'startTimer' }));
    stopTimerBtn.addEventListener('click', () => sendCommandToGame({ action: 'stopTimer' }));
    quitGameBtn.addEventListener('click', () => {
        if (confirm(`Are you sure you want to end the game for ${adminCurrentUser?.name}? They will walk away with the last milestone amount.`)) {
            sendCommandToGame({ action: 'quitGame' });
        }
    });

    // Poll Controls
    showPollResultsBtn.addEventListener('click', () => {
        // Display locally & send command to game screen
        // Ensure pollData is relevant to the *game's* current question, not just admin view
        const gameCurrentQuestionId = adminCurrentUser?.progress.currentQuestionIndex;
        if (adminCurrentQuestion && gameCurrentQuestionId === adminCurrentQuestion.id) {
             displayAdminPollResults(audiencePollData); // Display on admin panel
             sendCommandToGame({ action: 'showPollResults', data: audiencePollData }); // Send to game screen
        } else {
            alert("Poll data might be outdated or not for the user's current question.");
            // Maybe fetch fresh poll data if using a backend?
        }
    });

    // Lifeline Activation Buttons
    lifelineButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const lifelineAction = `activate${btn.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('').replace('Activate', '')}`;
             // Map button id like 'activate-fifty-fifty' to action 'activateFiftyFifty'
             // Ensure the key matches the function names in game.js (e.g., activateFiftyFifty, activateSwapQuestion)
            const correctedAction = btn.id.replace(/-([a-z])/g, (g) => g[1].toUpperCase()); // activate-fifty-fifty -> activateFiftyFifty

            sendCommandToGame({ action: correctedAction });
        });
    });

    // Question Viewer
    viewQuestionDetailsBtn.addEventListener('click', () => {
        const selectedQuestionId = parseInt(questionViewSelectEl.value, 10);
        const questionToView = allQuestions.find(q => q.id === selectedQuestionId);
        if (questionToView) {
            displayQuestionDetails(questionToView);
        }
    });

    // Toggle Game Screen
    toggleGameScreenBtn.addEventListener('click', () => {
        if (gameScreenWindow && !gameScreenWindow.closed) {
            gameScreenWindow.focus();
        } else {
            gameScreenWindow = window.open('game.html', 'KBCGameScreen', 'width=1200,height=800');
        }
    });


    // --- Listen for Game State Updates (via LocalStorage) ---
    window.addEventListener('storage', (event) => {
        // Update from game.js (user progress, lifelines, asked questions)
        if (event.key === 'kbcGameStateUpdate' && event.newValue) {
            try {
                const update = JSON.parse(event.newValue);
                console.log('Admin received game state update:', update);

                // Update local user data
                const userIndex = users.findIndex(u => u.id === update.userId);
                if (userIndex !== -1) {
                    users[userIndex].progress = update.progress;
                    // Update global asked IDs set
                    if (update.askedQuestionIds) {
                         update.askedQuestionIds.forEach(id => askedQuestionIds.add(id));
                    }

                    // If the update is for the currently selected user, refresh admin UI
                    if (adminCurrentUser && adminCurrentUser.id === update.userId) {
                        adminCurrentUser.progress = update.progress; // Update local state too
                        updateAdminUIForUser();
                    }
                }
            } catch (e) {
                 console.error("Error processing game state update:", e);
            }
        }

        // Votes from poll.js
        if (event.key === 'kbcPollVote' && event.newValue) {
             try {
                const voteData = JSON.parse(event.newValue);
                console.log('Admin received poll vote:', voteData);
                // Check if the vote is for the question currently displayed in admin (or maybe the user's actual current question?)
                // Let's tie it to the question the admin is currently viewing, assuming poll was activated for that.
                if (adminCurrentQuestion && voteData.questionId === adminCurrentQuestion.id) {
                    const voteOption = voteData.option;
                    audiencePollData[voteOption] = (audiencePollData[voteOption] || 0) + 1;
                    // Optionally update admin poll chart in real-time
                    // displayAdminPollResults(audiencePollData);
                }
             } catch(e) {
                 console.error("Error processing poll vote:", e);
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


    // Answer Marking Controls
    markCorrectBtn.addEventListener('click', () => {
        if (!adminCurrentUser || !adminCurrentQuestion) {
            alert("Please select a user and ensure a question is loaded.");
            return;
        }
        // Send command to game screen to visually mark the *currently selected* answer as correct
        sendCommandToGame({ action: 'markAnswer', result: 'correct' });
    });

    markIncorrectBtn.addEventListener('click', () => {
         if (!adminCurrentUser || !adminCurrentQuestion) {
            alert("Please select a user and ensure a question is loaded.");
            return;
        }
        // Send command to game screen to visually mark the *currently selected* answer as incorrect
        sendCommandToGame({ action: 'markAnswer', result: 'incorrect' });
    });


    // --- Listen for Game State Updates (via LocalStorage) ---
    window.addEventListener('storage', (event) => {
        // Update from game.js (user progress, lifelines, asked questions)
        if (event.key === 'kbcGameStateUpdate' && event.newValue) {
            try {
                const update = JSON.parse(event.newValue);
                console.log('Admin received game state update:', update);

                // Update local user data
                const userIndex = users.findIndex(u => u.id === update.userId);
                if (userIndex !== -1) {
                    users[userIndex].progress = update.progress;
                    // Update global asked IDs set
                    if (update.askedQuestionIds) {
                         update.askedQuestionIds.forEach(id => askedQuestionIds.add(id));
                    }

                    // If the update is for the currently selected user, refresh admin UI
                    if (adminCurrentUser && adminCurrentUser.id === update.userId) {
                        adminCurrentUser.progress = update.progress; // Update local state too
                        updateAdminUIForUser();
                    }
                }
            } catch (e) {
                 console.error("Error processing game state update:", e);
            }
        }

        // Update selected answer display from game.js
        if (event.key === 'kbcAnswerSelected' && event.newValue) {
            try {
                const answerData = JSON.parse(event.newValue);
                console.log('Admin received selected answer:', answerData);
                // Check if the update is for the currently selected user in the admin panel
                if (adminCurrentUser && adminCurrentUser.id === answerData.userId) {
                    // Update the display regardless of which question admin is viewing
                    selectedAnswerEl.textContent = answerData.selectedOption || 'None';
                    // Optionally, ensure the admin view loads the question the user just answered
                    // loadQuestionForAdminView(answerData.questionId); // Uncomment if you want admin view to auto-sync
                }
            } catch (e) {
                console.error("Error processing selected answer update:", e);
            }
        }


        // Votes from poll.js
        if (event.key === 'kbcPollVote' && event.newValue) {
             try {
                const voteData = JSON.parse(event.newValue);
                console.log('Admin received poll vote:', voteData);
                // Check if the vote is for the question currently displayed in admin (or maybe the user's actual current question?)
                // Let's tie it to the question the admin is currently viewing, assuming poll was activated for that.
                if (adminCurrentQuestion && voteData.questionId === adminCurrentQuestion.id) {
                    const voteOption = voteData.option;
                    audiencePollData[voteOption] = (audiencePollData[voteOption] || 0) + 1;
                    // Optionally update admin poll chart in real-time
                    // displayAdminPollResults(audiencePollData);
                }
             } catch(e) {
                 console.error("Error processing poll vote:", e);
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
    fetchData(); // Fetch both questions and users
});
