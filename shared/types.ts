// ═══ Client-safe subset of types ═══
// (No solution or server-internal fields)

export const BOTTLE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type BottleColor = (typeof BOTTLE_COLORS)[number];

export const BOARD_SIZE = 6;

export interface Feedback {
    correct: number;
    incorrect: number;
}

export interface RankTier {
    name: string;
    range: string;
    isLegendary?: boolean;
}

export const RANKS: RankTier[] = [
    { name: 'Bronze V', range: '0 - 99 RP' },
    { name: 'Bronze IV', range: '100 - 199 RP' },
    { name: 'Bronze III', range: '200 - 299 RP' },
    { name: 'Bronze II', range: '300 - 399 RP' },
    { name: 'Bronze I', range: '400 - 499 RP' },
    { name: 'Silver V', range: '500 - 599 RP' },
    { name: 'Silver IV', range: '600 - 699 RP' },
    { name: 'Silver III', range: '700 - 799 RP' },
    { name: 'Silver II', range: '800 - 899 RP' },
    { name: 'Silver I', range: '900 - 999 RP' },
    { name: 'Gold V', range: '1000 - 1099 RP' },
    { name: 'Gold IV', range: '1100 - 1199 RP' },
    { name: 'Gold III', range: '1200 - 1299 RP' },
    { name: 'Gold II', range: '1300 - 1399 RP' },
    { name: 'Gold I', range: '1400 - 1499 RP' },
    { name: 'Platinum V', range: '1500 - 1599 RP' },
    { name: 'Platinum IV', range: '1600 - 1699 RP' },
    { name: 'Platinum III', range: '1700 - 1799 RP' },
    { name: 'Platinum II', range: '1800 - 1899 RP' },
    { name: 'Platinum I', range: '1900 - 1999 RP' },
    { name: 'Diamond V', range: '2000 - 2099 RP' },
    { name: 'Diamond IV', range: '2100 - 2199 RP' },
    { name: 'Diamond III', range: '2200 - 2299 RP' },
    { name: 'Diamond II', range: '2300 - 2399 RP' },
    { name: 'Diamond I', range: '2400 - 2499 RP' },
    { name: 'GrandMaster V', range: '2500 - 2599 RP' },
    { name: 'GrandMaster IV', range: '2600 - 2699 RP' },
    { name: 'GrandMaster III', range: '2700 - 2799 RP' },
    { name: 'GrandMaster II', range: '2800 - 2899 RP' },
    { name: 'GrandMaster I', range: '2900 - 2999 RP' },
    { name: 'Legendary', range: '3000+ RP', isLegendary: true },
];

export interface GameStartData {
    gameId: string;
    board: BottleColor[];
    yourPlayerId: string;
    yourFrame: string | null;
    opponentId: string;
    opponentUsername: string;
    opponentFrame: string | null;
    roundDeadline: number;
    roundDuration: number;
    roundNumber: number;
    isRanked?: boolean;
}

export interface RoundUpdateData {
    roundNumber: number;
    roundDeadline: number;
    roundDuration: number;
    yourFeedback: Feedback | null;
    opponentFeedback: Feedback | null;
}

export interface GameOverRewards {
    exp: number;
    gold: number;
    leveledUp?: boolean;
    newLevel?: number;
    rpChange?: number;
    newRp?: number;
    newRank?: string;
    rankChanged?: 'promoted' | 'demoted' | null;
}

export function getRankIcon(rank: string | undefined): string {
    if (!rank) return '⭐';
    if (rank.startsWith('Bronze')) return '🐚';
    if (rank.startsWith('Silver')) return '⚓';
    if (rank.startsWith('Gold')) return '🔱';
    if (rank.startsWith('Platinum')) return '💠';
    if (rank.startsWith('Diamond')) return '💎';
    if (rank.startsWith('GrandMaster') || rank.startsWith('Grandmaster')) return '👑';
    if (rank === 'Legendary') return '🔥';
    return '⭐';
}

export function getRankFromRp(rp: number): string {
    if (rp >= 3000) return 'Legendary';

    const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'GrandMaster'];
    const subTierIdx = Math.floor(rp / 500);
    const tierName = tiers[Math.min(subTierIdx, tiers.length - 1)];

    const withinTierRp = rp % 500;
    const subTiers = ['V', 'IV', 'III', 'II', 'I'];
    const subTier = subTiers[Math.floor(withinTierRp / 100)];

    return `${tierName} ${subTier}`;
}


export interface GameOverData {
    winnerId: string;
    reason: 'solved' | 'forfeit' | 'surrender';
    solution: BottleColor[];
    finalBoards: Record<string, BottleColor[]>;
    rewards?: GameOverRewards;
}

export interface LobbyCreatedData {
    lobbyId: string;
    code: string;
}

export interface ErrorData {
    code: string;
    message: string;
}
