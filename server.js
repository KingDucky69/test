// WebSocket Server for Celebrity Guessing Game
// Install dependencies: npm install ws express

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(__dirname));

// Game storage
const activeGames = new Map();
const playerConnections = new Map();

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

function generateGameCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getRandomCelebrity() {
    return CELEBRITIES[Math.floor(Math.random() * CELEBRITIES.length)];
}

function broadcast(gameCode, message, excludeWs = null) {
    const game = activeGames.get(gameCode);
    if (!game) return;

    [game.player1Ws, game.player2Ws].forEach(ws => {
        if (ws && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    let currentGameCode = null;
    let playerRole = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('Received message:', message);
            
            switch (message.type) {
                case 'createGame':
                    handleCreateGame(ws, message);
                    break;
                    
                case 'joinGame':
                    handleJoinGame(ws, message);
                    break;
                    
                case 'guess':
                    handleGuess(ws, message);
                    break;
                    
                case 'disconnect':
                    handleDisconnect(ws);
                    break;
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        handleDisconnect(ws);
    });

    function handleCreateGame(ws, message) {
        const gameCode = generateGameCode();
        const celebrity1 = getRandomCelebrity();
        
        console.log(`Creating game with code: ${gameCode} for player: ${message.playerName}`);
        
        const game = {
            gameCode,
            player1: message.playerName,
            player1Ws: ws,
            player1Celebrity: celebrity1,
            player1Guesses: [],
            player2: null,
            player2Ws: null,
            player2Celebrity: null,
            player2Guesses: [],
            status: 'waiting',
            winner: null
        };
        
        activeGames.set(gameCode, game);
        console.log(`Game stored. Active games now:`, Array.from(activeGames.keys()));
        
        playerConnections.set(ws, { gameCode, role: 'player1' });
        currentGameCode = gameCode;
        playerRole = 'player1';
        
        ws.send(JSON.stringify({
            type: 'gameCreated',
            gameCode,
            celebrity: celebrity1,
            playerName: message.playerName
        }));
        
        console.log(`Game created: ${gameCode}`);
    }

    function handleJoinGame(ws, message) {
        console.log(`Attempting to join game: "${message.gameCode}" (type: ${typeof message.gameCode})`);
        console.log(`Active games:`, Array.from(activeGames.keys()));
        
        const game = activeGames.get(message.gameCode);
        
        if (!game) {
            console.log(`Game ${message.gameCode} not found!`);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Game not found! Check the code and try again.'
            }));
            return;
        }
        
        if (game.status !== 'waiting') {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'This game is already full!'
            }));
            return;
        }
        
        const celebrity2 = getRandomCelebrity();
        
        game.player2 = message.playerName;
        game.player2Ws = ws;
        game.player2Celebrity = celebrity2;
        game.status = 'active';
        
        playerConnections.set(ws, { gameCode: message.gameCode, role: 'player2' });
        currentGameCode = message.gameCode;
        playerRole = 'player2';
        
        // Send to player 2
        ws.send(JSON.stringify({
            type: 'gameJoined',
            gameCode: message.gameCode,
            yourCelebrity: celebrity2,
            opponentName: game.player1,
            opponentCelebrity: game.player1Celebrity
        }));
        
        // Notify player 1
        if (game.player1Ws && game.player1Ws.readyState === WebSocket.OPEN) {
            game.player1Ws.send(JSON.stringify({
                type: 'opponentJoined',
                opponentName: message.playerName,
                opponentCelebrity: celebrity2
            }));
        }
        
        console.log(`Player joined game: ${message.gameCode}`);
    }

    function handleGuess(ws, message) {
        const connection = playerConnections.get(ws);
        if (!connection) return;
        
        const game = activeGames.get(connection.gameCode);
        if (!game || game.status !== 'active') return;
        
        const isPlayer1 = connection.role === 'player1';
        const guess = message.guess;
        const targetCelebrity = isPlayer1 ? game.player2Celebrity : game.player1Celebrity;
        
        // Add guess to appropriate player
        if (isPlayer1) {
            game.player1Guesses.push(guess);
        } else {
            game.player2Guesses.push(guess);
        }
        
        // Check if correct
        const isCorrect = guess.toLowerCase().trim() === targetCelebrity.toLowerCase().trim();
        
        // Send result to guessing player
        ws.send(JSON.stringify({
            type: 'GUESS_RESULT',
            guess,
            correct: isCorrect
        }));
        
        // Notify opponent about the guess
        const opponentWs = isPlayer1 ? game.player2Ws : game.player1Ws;
        if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
            opponentWs.send(JSON.stringify({
                type: 'opponentGuess',
                guess
            }));
        }
        
        // If correct, end game
        if (isCorrect) {
            game.status = 'finished';
            game.winner = connection.role;
            
            // Notify both players
            broadcast(connection.gameCode, {
                type: 'GAME_OVER',
                winner: connection.role,
                winnerName: isPlayer1 ? game.player1 : game.player2,
                player1Celebrity: game.player1Celebrity,
                player2Celebrity: game.player2Celebrity
            });
            
            console.log(`Game ${connection.gameCode} finished. Winner: ${connection.role}`);
        }
    }

    function handleDisconnect(ws) {
        const connection = playerConnections.get(ws);
        if (!connection) return;
        
        const game = activeGames.get(connection.gameCode);
        if (game) {
            // Notify opponent
            const opponentWs = connection.role === 'player1' ? game.player2Ws : game.player1Ws;
            if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                opponentWs.send(JSON.stringify({
                    type: 'OPPONENT_DISCONNECTED'
                }));
            }
            
            // Clean up game
            activeGames.delete(connection.gameCode);
        }
        
        playerConnections.delete(ws);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`WebSocket server is ready`);
});
