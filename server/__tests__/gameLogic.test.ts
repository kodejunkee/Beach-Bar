import {
    generateSolution,
    generateScrambledBoard,
    validateSwap,
    applySwap,
    evaluateFeedback,
    checkWin,
    arraysEqual,
} from '../src/gameLogic';
import { BOTTLE_COLORS, BottleColor, BOARD_SIZE } from '../src/types';

describe('gameLogic', () => {
    // ─── generateSolution ─────────────────────────────────

    describe('generateSolution', () => {
        it('returns an array of length BOARD_SIZE', () => {
            const solution = generateSolution();
            expect(solution).toHaveLength(BOARD_SIZE);
        });

        it('contains all 6 unique colors', () => {
            const solution = generateSolution();
            const sorted = [...solution].sort();
            const expected = [...BOTTLE_COLORS].sort();
            expect(sorted).toEqual(expected);
        });

        it('produces different orderings across calls (statistical)', () => {
            const results = new Set<string>();
            for (let i = 0; i < 50; i++) {
                results.add(generateSolution().join(','));
            }
            // Should have more than 1 unique result in 50 tries
            expect(results.size).toBeGreaterThan(1);
        });
    });

    // ─── generateScrambledBoard ───────────────────────────

    describe('generateScrambledBoard', () => {
        it('returns a permutation of the solution', () => {
            const solution = generateSolution();
            const board = generateScrambledBoard(solution);
            expect([...board].sort()).toEqual([...solution].sort());
        });

        it('is NOT equal to the solution', () => {
            const solution = generateSolution();
            for (let i = 0; i < 20; i++) {
                const board = generateScrambledBoard(solution);
                expect(arraysEqual(board, solution)).toBe(false);
            }
        });

        it('has the same length as the solution', () => {
            const solution = generateSolution();
            const board = generateScrambledBoard(solution);
            expect(board).toHaveLength(solution.length);
        });
    });

    // ─── validateSwap ─────────────────────────────────────

    describe('validateSwap', () => {
        it('accepts valid pairs', () => {
            expect(validateSwap(0, 5, BOARD_SIZE)).toBe(true);
            expect(validateSwap(2, 3, BOARD_SIZE)).toBe(true);
            expect(validateSwap(1, 4, BOARD_SIZE)).toBe(true);
        });

        it('rejects same index', () => {
            expect(validateSwap(3, 3, BOARD_SIZE)).toBe(false);
        });

        it('rejects negative indices', () => {
            expect(validateSwap(-1, 3, BOARD_SIZE)).toBe(false);
            expect(validateSwap(0, -2, BOARD_SIZE)).toBe(false);
        });

        it('rejects out-of-range indices', () => {
            expect(validateSwap(0, 6, BOARD_SIZE)).toBe(false);
            expect(validateSwap(6, 0, BOARD_SIZE)).toBe(false);
            expect(validateSwap(10, 20, BOARD_SIZE)).toBe(false);
        });

        it('rejects non-integer indices', () => {
            expect(validateSwap(1.5, 3, BOARD_SIZE)).toBe(false);
            expect(validateSwap(0, 2.7, BOARD_SIZE)).toBe(false);
        });
    });

    // ─── applySwap ────────────────────────────────────────

    describe('applySwap', () => {
        it('correctly swaps two elements', () => {
            const board: BottleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            const result = applySwap(board, 0, 5);
            expect(result).toEqual(['orange', 'blue', 'green', 'yellow', 'purple', 'red']);
        });

        it('returns a new array (immutable)', () => {
            const board: BottleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            const result = applySwap(board, 0, 1);
            expect(result).not.toBe(board);
            // Original should be unchanged
            expect(board[0]).toBe('red');
        });

        it('preserves all elements', () => {
            const board: BottleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            const result = applySwap(board, 2, 4);
            expect([...result].sort()).toEqual([...board].sort());
        });
    });

    // ─── evaluateFeedback ─────────────────────────────────

    describe('evaluateFeedback', () => {
        it('returns all correct when board matches solution', () => {
            const solution: BottleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            const feedback = evaluateFeedback(solution, solution);
            expect(feedback).toEqual({ correct: 6, incorrect: 0 });
        });

        it('returns all incorrect when nothing matches', () => {
            const solution: BottleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            const board: BottleColor[] = ['blue', 'red', 'yellow', 'green', 'orange', 'purple'];
            const feedback = evaluateFeedback(board, solution);
            expect(feedback).toEqual({ correct: 0, incorrect: 6 });
        });

        it('returns partial match correctly', () => {
            const solution: BottleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            const board: BottleColor[] = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'];
            // Positions 0, 1, 4, 5 are correct = 4 correct
            const feedback = evaluateFeedback(board, solution);
            expect(feedback).toEqual({ correct: 4, incorrect: 2 });
        });

        it('correct + incorrect always equals board size', () => {
            const solution = generateSolution();
            const board = generateScrambledBoard(solution);
            const feedback = evaluateFeedback(board, solution);
            expect(feedback.correct + feedback.incorrect).toBe(BOARD_SIZE);
        });
    });

    // ─── checkWin ─────────────────────────────────────────

    describe('checkWin', () => {
        it('returns true when board matches solution', () => {
            const solution: BottleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            expect(checkWin([...solution], solution)).toBe(true);
        });

        it('returns false when board does not match', () => {
            const solution: BottleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            const board: BottleColor[] = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];
            expect(checkWin(board, solution)).toBe(false);
        });

        it('returns false for fully scrambled board', () => {
            const solution = generateSolution();
            const board = generateScrambledBoard(solution);
            expect(checkWin(board, solution)).toBe(false);
        });
    });

    // ─── arraysEqual ──────────────────────────────────────

    describe('arraysEqual', () => {
        it('returns true for identical arrays', () => {
            expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        });

        it('returns false for different arrays', () => {
            expect(arraysEqual([1, 2, 3], [3, 2, 1])).toBe(false);
        });

        it('returns false for different lengths', () => {
            expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
        });
    });
});
