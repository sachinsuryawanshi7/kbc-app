document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const participantForm = document.getElementById('participant-form');
    const participantNameInput = document.getElementById('participant-name');
    const submitNameBtn = document.getElementById('submit-name');
    const pollContent = document.getElementById('poll-content');
    const pollTimerEl = document.getElementById('poll-timer');
    const pollQuestionEl = document.getElementById('poll-question');
    const pollOptionsEl = document.getElementById('poll-options');
    const thankYouScreen = document.getElementById('thank-you');
    const timeUpScreen = document.getElementById('time-up');
    const darkModeToggle = document.getElementById('dark-mode-toggle-poll');
    const body = document.body;

    // State
    let currentQuestion = null;
    let questionId = null;
    let participantName = null;
    let pollTimerInterval = null;
    let pollTimeLeft = 60; // Default, might be synced from admin later

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

    // --- Get Question ID from URL ---
    function getQuestionIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('questionId');
    }

    // --- Fetch Specific Question ---
    async function fetchPollQuestion(id) {
        try {
            const response = await fetch('data/questions.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            // Find the question by ID
            currentQuestion = data.questions.find(q => q.id.toString() === id);
            if (currentQuestion) {
                displayPollQuestion();
            } else {
                pollQuestionEl.textContent = 'Error: Question not found.';
            }
        } catch (error) {
            console.error("Could not fetch poll question:", error);
            pollQuestionEl.textContent = 'Error loading question.';
        }
    }

    // --- Display Question and Options ---
    function displayPollQuestion() {
        if (!currentQuestion) return;
        pollQuestionEl.textContent = currentQuestion.question;
        pollOptionsEl.innerHTML = ''; // Clear previous options

        ['A', 'B', 'C', 'D'].forEach(key => {
            const optionDiv = document.createElement('div');
            optionDiv.classList.add('poll-option'); // Use poll-specific class
            optionDiv.dataset.option = key;

            const letterDiv = document.createElement('div');
            letterDiv.classList.add('option-letter');
            letterDiv.textContent = key;

            const textDiv = document.createElement('div');
            textDiv.classList.add('option-text');
            textDiv.textContent = currentQuestion.options[key];

            optionDiv.appendChild(letterDiv);
            optionDiv.appendChild(textDiv);
            optionDiv.addEventListener('click', handlePollVote);
            pollOptionsEl.appendChild(optionDiv);
        });

        startPollTimer(); // Start timer when question is displayed
    }

    // --- Handle Name Submission ---
    submitNameBtn.addEventListener('click', () => {
        participantName = participantNameInput.value.trim();
        if (participantName) {
            participantForm.style.display = 'none';
            pollContent.style.display = 'block';
            questionId = getQuestionIdFromUrl();
            if (questionId) {
                fetchPollQuestion(questionId);
            } else {
                pollQuestionEl.textContent = 'Error: No question ID provided.';
            }
        } else {
            alert('Please enter your name.');
        }
    });

    // --- Poll Timer ---
    function startPollTimer() {
        clearInterval(pollTimerInterval);
        pollTimeLeft = 60; // Reset timer
        pollTimerEl.textContent = pollTimeLeft;

        pollTimerInterval = setInterval(() => {
            pollTimeLeft--;
            pollTimerEl.textContent = pollTimeLeft;
            if (pollTimeLeft <= 0) {
                endPoll();
            }
        }, 1000);
    }

    function stopPollTimer() {
        clearInterval(pollTimerInterval);
    }

    // --- Handle Vote ---
    function handlePollVote(event) {
        stopPollTimer();
        const selectedOption = event.currentTarget.dataset.option;
        console.log(`Poll vote: ${selectedOption} by ${participantName}`);
        console.log("Participant Name",participantName);

        // Send vote to "API"
        submitPollResponse(voteData);

        // Show thank you message
        pollContent.style.display = 'none';
        thankYouScreen.style.display = 'block';

        // Disable further voting
        pollOptionsEl.querySelectorAll('.poll-option').forEach(opt => {
            opt.removeEventListener('click', handlePollVote);
            opt.style.cursor = 'not-allowed';
            opt.style.opacity = '0.6';
        });
    }

    // --- End Poll (Time Up) ---
    function endPoll() {
        stopPollTimer();
        pollContent.style.display = 'none';
        thankYouScreen.style.display = 'none'; // Hide thank you if time ran out before voting
        timeUpScreen.style.display = 'block';

        // Disable voting options
        pollOptionsEl.querySelectorAll('.poll-option').forEach(opt => {
            opt.removeEventListener('click', handlePollVote);
            opt.style.cursor = 'not-allowed';
            opt.style.opacity = '0.6';
        });
    }

    // --- Simulate API call to submit poll response ---
    async function submitPollResponse(voteData) {
        const filePath = 'data/poll_results.json';
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
                    console.error("Error reading poll data file:", response.status);
                    // Handle the error appropriately, maybe show a message to the user
                    return;
                }
            } catch (e) {
                console.warn("Could not parse existing poll data (may be empty or invalid JSON), starting fresh.", e);
                existingData = []; // Start with a clean slate if parsing fails
            }

            // Add the new vote data
            existingData.push(voteData);

            // Write the combined data back to the file
            const jsonData = JSON.stringify(existingData, null, 2); // Pretty print for readability
            
            // Use the write_to_file tool
            await writeToFile(filePath, jsonData);

        } catch (error) {
            console.error("Error writing poll data to file:", error);
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

    // --- Initial State ---
    participantForm.style.display = 'block';
    waitingScreen.style.display = 'none';
    questionContainer.style.display = 'none';
    thankYouScreen.style.display = 'none';
    timeUpScreen.style.display = 'none';
    resultsScreen.style.display = 'none';

});
