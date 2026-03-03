# Mastermind Online

A React Native + Expo multiplayer, turn-based logic puzzle game. 
Inspired by Mastermind and color-code bottle puzzles.

## Game Concept

Two players compete in the same match to crack a hidden code (an arrangement of 6 colored bottles).  
Both players receive the same scrambled starting board. 
Players take turns swapping two bottles to arrange them correctly.

After every turn, you receive abstract feedback:
- **✓ Correct**: Bottles of the correct color in the correct position.
- **✗ Incorrect**: Bottles not in the right spot.
*(The system does not tell you WHICH specific bottles are correct).*

The first person to exactly arrange the bottles to match the hidden solution wins the game!

## Features
- **Online Multiplayer**: Real-time turn-based action against a random opponent or a friend.
- **Private Lobbies**: Generate a 6-character code and invite another player.
- **Server Authoritative State**: Cheat-resistant. The hidden solution is only evaluated on the backend and is never visible to the client until the game ends.
- **Colorblind Safe**: Bottles are identifiable by both color and a distinct shape element.
- **Turn Timers**: Strict 15-second turns per player to keep the game moving.

## Tech Stack
- **Frontend**: React Native, Expo, React Navigation (Expo Router)
- **Backend**: Node.js, Socket.IO
- **Language**: TypeScript

## Project Structure
- `/app`, `/components`, `/hooks`, `/lib`, `/shared`: Frontend the React Native code.
- `/server/src`: The Node.js and Socket.IO authoritative game server. 

## Getting Started

### 1. Start the Backend Server
The server manages match state and the authoritative timer.
```bash
cd server
npm install
npm run dev
```
The server will start on port `3001`.

### 2. Configure Environment Variables
In the root directory, create a `.env` file (if not present) and set your server URL.
If run locally for dev, using `localhost` is fine for the web or an emulator. 
If testing on a physical phone, you must change this to your machine's local IP address.
```
EXPO_PUBLIC_SERVER_URL=http://localhost:3001
```

### 3. Start the Frontend App
Open a new terminal session in the root of the project:
```bash
npm install
npx expo start
```
Scan the QR code with your phone (Expo Go app) or press `a` for Android Emulator, `i` for iOS Simulator. 
*(Remember to update the `.env` if using a physical device!).*

## Testing
To run the server-side unit tests for game logic:
```bash
cd server
npm run test
```
