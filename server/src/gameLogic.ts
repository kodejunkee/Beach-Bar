import { BottleColor, BOTTLE_COLORS, BOARD_SIZE, Feedback } from './types';

/**
 * Fisher-Yates shuffle (in place, returns same array).
 */
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Check if two arrays are element-wise equal.
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Generate a hidden solution — a random permutation of the 6 colors.
 */
export function generateSolution(): BottleColor[] {
    return shuffle([...BOTTLE_COLORS]);
}

/**
 * Generate a scrambled starting board that is guaranteed NOT equal to the solution.
 * Both players receive this same starting board.
 */
export function generateScrambledBoard(solution: BottleColor[]): BottleColor[] {
    let board: BottleColor[];
    do {
        board = shuffle([...solution]);
    } while (arraysEqual(board, solution));
    return board;
}

/**
 * Validate that a swap move has legal indices.
 */
export function validateSwap(index1: number, index2: number, boardSize: number = BOARD_SIZE): boolean {
    if (!Number.isInteger(index1) || !Number.isInteger(index2)) return false;
    if (index1 < 0 || index1 >= boardSize) return false;
    if (index2 < 0 || index2 >= boardSize) return false;
    if (index1 === index2) return false;
    return true;
}

/**
 * Apply a swap immutably — returns a new board array.
 */
export function applySwap(board: BottleColor[], index1: number, index2: number): BottleColor[] {
    const next = [...board];
    [next[index1], next[index2]] = [next[index2], next[index1]];
    return next;
}

/**
 * Evaluate the board against the solution.
 * Returns how many are in the correct position and how many are not.
 * Does NOT reveal which specific bottles are correct.
 */
export function evaluateFeedback(board: BottleColor[], solution: BottleColor[]): Feedback {
    let correct = 0;
    for (let i = 0; i < solution.length; i++) {
        if (board[i] === solution[i]) correct++;
    }
    return {
        correct,
        incorrect: solution.length - correct,
    };
}

/**
 * Check if the board exactly matches the solution (win condition).
 */
export function checkWin(board: BottleColor[], solution: BottleColor[]): boolean {
    return arraysEqual(board, solution);
}
