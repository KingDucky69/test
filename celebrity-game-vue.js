const { createApp } = Vue;

// Celebrity list
const CELEBRITIES = [
    'Taylor Swift', 'Beyoncé', 'Drake', 'Ariana Grande', 'Ed Sheeran',
    'Rihanna', 'Justin Bieber', 'Lady Gaga', 'Kanye West', 'Adele',
    'Leonardo DiCaprio', 'Brad Pitt', 'Jennifer Lawrence', 'Tom Cruise', 'Scarlett Johansson',
    'Dwayne Johnson', 'Will Smith', 'Emma Watson', 'Robert Downey Jr', 'Chris Hemsworth',
    'Kim Kardashian', 'Kylie Jenner', 'Cristiano Ronaldo', 'Lionel Messi', 'LeBron James',
    'Serena Williams', 'Tom Brady', 'Roger Federer', 'Usain Bolt', 'Michael Jordan',
    'Elon Musk', 'Jeff Bezos', 'Bill Gates', 'Mark Zuckerberg', 'Oprah Winfrey',
    'Ellen DeGeneres', 'Jimmy Fallon', 'Stephen Colbert', 'James Corden', 'Trevor Noah',
    'Ryan Reynolds', 'Ryan Gosling', 'Chris Pratt', 'Jennifer Aniston', 'Angelina Jolie',
    'Johnny Depp', 'Morgan Freeman', 'Denzel Washington', 'Sandra Bullock', 'Julia Roberts',
    'Harry Styles', 'Billie Eilish', 'Post Malone', 'The Weeknd', 'Bruno Mars',
    'Selena Gomez', 'Demi Lovato', 'Miley Cyrus', 'Katy Perry', 'Shakira',
    'David Beckham', 'Neymar', 'Lewis Hamilton', 'Rafael Nadal', 'Novak Djokovic',
    'Keanu Reeves', 'Nicolas Cage', 'Samuel L Jackson', 'Meryl Streep', 'Tom Hanks',
    'George Clooney', 'Matt Damon', 'Ben Affleck', 'Christian Bale', 'Hugh Jackman'
];

createApp({
    data() {
        return {
            currentScreen: 'menu',
            playerName: '',
            gameCode: '',
            currentGuess: '',
            feedbackMessage: '',
            feedbackClass: '',
            yourStatus: '🤔',
            opponentStatus: '🤔',
            gameState: {
                playerName: '',
                opponentName: '',
                gameCode: '',
                yourCelebrity: '',
                opponentCelebrity: '',
                yourGuesses: [],
                opponentGuesses: [],
                gameOver: false,
                winner: null
            },
            message: {
                text: '',
                show: false,
                type: ''
            },
            ws: null,
            wsConnected: false,
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            rematchRequested: false,
            rematchStatus: ''
        };
    },
    mounted() {
        this.connectWebSocket();
    },
    computed: {
        gameOverTitle() {
            if (this.gameState.winner === 'you') {
                return '🎉 You Win! 🎉';
            } else if (this.gameState.winner === 'opponent') {
                return '💔 You Lost 💔';
            }
            return 'Game Over';
        },
        gameOverMessage() {
            if (this.gameState.winner === 'you') {
                return `You correctly guessed ${this.gameState.opponentCelebrity}!`;
            } else if (this.gameState.winner === 'opponent') {
                return `${this.gameState.opponentName} correctly guessed ${this.gameState.yourCelebrity}!`;
            }
            return 'Game ended';
        }
    },
    methods: {
        generateGameCode() {
            return Math.floor(100000 + Math.random() * 900000).toString();
        },
        getRandomCelebrity() {
            return CELEBRITIES[Math.floor(Math.random() * CELEBRITIES.length)];
        },
        normalizeString(str) {
            return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
        },
        showMessage(text, type = '') {
            this.message.text = text;
            this.message.type = type;
            this.message.show = true;
            setTimeout(() => {
                this.message.show = false;
            }, 3000);
        },
        
        // WebSocket connection
        connectWebSocket() {
            // IMPORTANT: Change 'your-server' to your actual Render app name
            const wsUrl = window.location.hostname === 'localhost' 
                ? 'ws://localhost:3000' 
                : 'wss://celebrity-game-l4nl.onrender.com'; // ← Must be wss:// for secure connection!
            
            try {
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('Connected to game server');
                    this.wsConnected = true;
                    this.reconnectAttempts = 0;
                    this.showMessage('Connected to server', 'success');
                };
                
                this.ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    this.handleServerMessage(data);
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.wsConnected = false;
                };
                
                this.ws.onclose = () => {
                    console.log('Disconnected from game server');
                    this.wsConnected = false;
                    
                    // Try to reconnect
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                        setTimeout(() => this.connectWebSocket(), 2000);
                    } else {
                        this.showMessage('Lost connection to server', 'error');
                    }
                };
            } catch (error) {
                console.error('Failed to connect to server:', error);
                this.showMessage('Could not connect to server', 'error');
            }
        },
        
        sendToServer(data) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(data));
            } else {
                console.error('WebSocket not connected');
                this.showMessage('Not connected to server', 'error');
            }
        },
        
        handleServerMessage(data) {
            console.log('Received from server:', data);
            
            switch (data.type) {
                case 'gameCreated':
                    this.gameState.gameCode = data.gameCode;
                    this.gameState.yourCelebrity = data.celebrity;
                    this.currentScreen = 'waiting';
                    break;
                    
                case 'opponentJoined':
                    this.gameState.opponentName = data.opponentName;
                    this.gameState.opponentCelebrity = data.opponentCelebrity;
                    this.showMessage('Opponent joined!', 'success');
                    setTimeout(() => this.startGame(), 1000);
                    break;
                    
                case 'gameJoined':
                    this.gameState.opponentName = data.opponentName;
                    this.gameState.yourCelebrity = data.yourCelebrity;
                    this.gameState.opponentCelebrity = data.opponentCelebrity;
                    this.showMessage('Joined game successfully!', 'success');
                    this.startGame();
                    break;
                    
                case 'opponentGuess':
                    this.gameState.opponentGuesses.push(data.guess);
                    
                    if (this.normalizeString(data.guess) === this.normalizeString(this.gameState.yourCelebrity)) {
                        this.gameState.gameOver = true;
                        this.gameState.winner = 'opponent';
                        this.opponentStatus = '🎉';
                        this.showMessage('Your opponent guessed correctly!', 'error');
                        setTimeout(() => this.endGame(false), 2000);
                    }
                    break;
                    
                case 'rematchRequest':
                    this.rematchStatus = `${data.requesterName} wants a rematch!`;
                    this.showMessage('Your opponent wants a rematch!', 'success');
                    break;
                    
                case 'rematchAccepted':
                    this.showMessage('Rematch starting!', 'success');
                    this.gameState.yourCelebrity = data.yourCelebrity;
                    this.gameState.opponentCelebrity = data.opponentCelebrity;
                    this.gameState.yourGuesses = [];
                    this.gameState.opponentGuesses = [];
                    this.gameState.gameOver = false;
                    this.gameState.winner = null;
                    this.rematchRequested = false;
                    this.rematchStatus = '';
                    setTimeout(() => this.startGame(), 1000);
                    break;
                    
                case 'error':
                    this.showMessage(data.message, 'error');
                    if (data.message.includes('not found') || data.message.includes('full')) {
                        setTimeout(() => this.backToMenu(), 2000);
                    }
                    break;
            }
        },
        
        // Screen navigation
        showScreen(screen) {
            this.currentScreen = screen;
            this.playerName = '';
            this.gameCode = '';
        },
        showCreateScreen() {
            this.currentScreen = 'create';
        },
        showJoinScreen() {
            this.currentScreen = 'join';
        },
        backToMenu() {
            this.currentScreen = 'menu';
            this.playerName = '';
            this.gameCode = '';
            this.gameState = {
                playerName: '',
                opponentName: '',
                gameCode: '',
                yourCelebrity: '',
                opponentCelebrity: '',
                yourGuesses: [],
                opponentGuesses: [],
                gameOver: false,
                winner: null
            };
        },
        
        // Game management
        createGame() {
            if (!this.playerName.trim()) {
                this.showMessage('Please enter your name', 'error');
                return;
            }
            
            if (!this.wsConnected) {
                this.showMessage('Connecting to server...', 'error');
                return;
            }
            
            this.gameState.playerName = this.playerName.trim();
            this.gameState.yourGuesses = [];
            this.gameState.opponentGuesses = [];
            this.gameState.gameOver = false;
            
            this.sendToServer({
                type: 'createGame',
                playerName: this.gameState.playerName
            });
        },
        joinGame() {
            if (!this.playerName.trim()) {
                this.showMessage('Please enter your name', 'error');
                return;
            }
            
            if (!this.gameCode || this.gameCode.length !== 6) {
                this.showMessage('Please enter a valid 6-digit code', 'error');
                return;
            }
            
            if (!this.wsConnected) {
                this.showMessage('Connecting to server...', 'error');
                return;
            }
            
            this.gameState.playerName = this.playerName.trim();
            this.gameState.gameCode = this.gameCode;
            this.gameState.yourGuesses = [];
            this.gameState.opponentGuesses = [];
            this.gameState.gameOver = false;
            
            this.sendToServer({
                type: 'joinGame',
                playerName: this.gameState.playerName,
                gameCode: this.gameCode
            });
        },
        cancelGame() {
            this.backToMenu();
        },
        copyCode() {
            navigator.clipboard.writeText(this.gameState.gameCode).then(() => {
                this.showMessage('Code copied to clipboard!', 'success');
            }).catch(() => {
                this.showMessage('Failed to copy code', 'error');
            });
        },
        
        // Game play
        startGame() {
            this.currentScreen = 'game';
            this.currentGuess = '';
            this.feedbackMessage = '';
            this.feedbackClass = '';
            this.yourStatus = '🤔';
            this.opponentStatus = '🤔';
        },
        submitGuess() {
            if (this.gameState.gameOver) {
                this.showMessage('Game is already over!', 'error');
                return;
            }
            
            const guess = this.currentGuess.trim();
            
            if (!guess) {
                this.showMessage('Please enter a guess', 'error');
                return;
            }
            
            // Check if already guessed
            if (this.gameState.yourGuesses.some(g => 
                this.normalizeString(g) === this.normalizeString(guess)
            )) {
                this.showMessage('You already guessed that!', 'error');
                return;
            }
            
            // Add to guesses
            this.gameState.yourGuesses.push(guess);
            
            // Send to server
            this.sendToServer({
                type: 'guess',
                gameCode: this.gameState.gameCode,
                guess: guess
            });
            
            // Check if correct
            if (this.normalizeString(guess) === this.normalizeString(this.gameState.opponentCelebrity)) {
                this.yourStatus = '🎉';
                this.feedbackMessage = '🎉 Correct! You win! 🎉';
                this.feedbackClass = 'correct';
                this.gameState.gameOver = true;
                this.gameState.winner = 'you';
                setTimeout(() => this.endGame(true), 2000);
            } else {
                this.feedbackMessage = '❌ Wrong! Try again';
                this.feedbackClass = 'incorrect';
                setTimeout(() => {
                    this.feedbackMessage = '';
                    this.feedbackClass = '';
                }, 2000);
            }
            
            this.currentGuess = '';
        },
        endGame(youWon) {
            this.currentScreen = 'gameOver';
            this.rematchRequested = false;
            this.rematchStatus = '';
        },
        requestRematch() {
            if (this.rematchRequested) {
                this.showMessage('Rematch already requested!', 'error');
                return;
            }
            
            this.rematchRequested = true;
            this.rematchStatus = 'Waiting for opponent to accept...';
            
            this.sendToServer({
                type: 'rematch',
                gameCode: this.gameState.gameCode,
                playerName: this.gameState.playerName
            });
        },
        playAgain() {
            this.playerName = this.gameState.playerName;
            this.currentScreen = 'menu';
            this.rematchRequested = false;
            this.rematchStatus = '';
        }
    }
}).mount('#app');
