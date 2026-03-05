import { BottleColor, Feedback } from './types';
import { evaluateFeedback, applySwap } from './gameLogic';

// Store the remaining possible solutions for each AI
const aiMemory: Record<string, BottleColor[][]> = {};

// Helper to generate all 720 permutations of a 6-item array
function getAllPermutations(colors: readonly BottleColor[]): BottleColor[][] {
    const result: BottleColor[][] = [];
    function permute(arr: BottleColor[], m: BottleColor[] = []) {
        if (arr.length === 0) {
            result.push(m);
        } else {
            for (let i = 0; i < arr.length; i++) {
                const curr = arr.slice();
                const next = curr.splice(i, 1);
                permute(curr.slice(), m.concat(next));
            }
        }
    }
    permute([...colors]);
    return result;
}

const BOTTLE_COLORS: readonly BottleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const ALL_BOARDS = getAllPermutations(BOTTLE_COLORS);

/**
 * AI Player logic for single-player mode.
 *
 * Strategy (TRULY BLIND): 
 * The AI plays like a human playing Mastermind. It stores all 720 possible permutations.
 * Every round, it uses the feedback from its PREVIOUS board to filter down the list of
 * candidates. It then tries to make a swap that leads to one of the remaining candidates.
 * It NEVER looks at the true solution.
 */
export function computeAIMove(
    aiId: string,
    currentBoard: BottleColor[],
    lastFeedback: Feedback | null
): { index1: number; index2: number } {

    // Initialize or retrieve memory. First round = no feedback yet.
    if (!aiMemory[aiId] || !lastFeedback) {
        aiMemory[aiId] = [...ALL_BOARDS];
    }

    let candidates = aiMemory[aiId];

    // Filter candidates based on the feedback from the previous round
    if (lastFeedback) {
        candidates = candidates.filter(cand =>
            evaluateFeedback(currentBoard, cand).correct === lastFeedback.correct
        );
        aiMemory[aiId] = candidates; // update memory
    }

    // Fallback in case of algorithm contradiction (shouldn't happen with valid feedback)
    if (candidates.length === 0) {
        candidates = [...ALL_BOARDS];
        aiMemory[aiId] = candidates;
    }

    // Now, we must make one of 15 possible swaps.
    const possibleSwaps: Array<{ i: number, j: number, newBoard: BottleColor[] }> = [];
    for (let i = 0; i < currentBoard.length; i++) {
        for (let j = i + 1; j < currentBoard.length; j++) {
            possibleSwaps.push({
                i, j, newBoard: applySwap(currentBoard, i, j)
            });
        }
    }

    // Strategy 1: Is there a swap that exactly matches a remaining candidate?
    // If so, pick it (it could be the winning move).
    const winningSwaps = possibleSwaps.filter(swap =>
        candidates.some(cand => cand.every((c, idx) => c === swap.newBoard[idx]))
    );

    if (winningSwaps.length > 0) {
        // We found moves that could be the answer. Pick one randomly to keep it dynamic.
        const pick = winningSwaps[Math.floor(Math.random() * winningSwaps.length)];
        return { index1: pick.i, index2: pick.j };
    }

    // Strategy 2: If no swap directly lands on a candidate (meaning the solution is >1 swap away),
    // pick a swap that brings the board closer to a random candidate.
    const targetCandidate = candidates[Math.floor(Math.random() * candidates.length)];

    let bestSwap = possibleSwaps[0];
    let bestScore = -1;

    for (const swap of possibleSwaps) {
        const score = evaluateFeedback(swap.newBoard, targetCandidate).correct;
        if (score > bestScore) {
            bestScore = score;
            bestSwap = swap;
        }
    }

    return { index1: bestSwap.i, index2: bestSwap.j };
}

/**
 * Returns a random delay in ms between min and max to simulate "thinking".
 */
export function getAIThinkDelay(minMs = 2000, maxMs = 4000): number {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Clears the AI memory when the game ends.
 */
export function cleanupAI(aiId: string) {
    delete aiMemory[aiId];
}
