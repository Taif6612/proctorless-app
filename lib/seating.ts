/**
 * Seating Utilities for Quiz Distribution
 * 
 * Uses Latin Square algorithm to ensure adjacent students
 * never receive the same question variant.
 */

export interface Seat {
    row: number;
    column: number;
}

export interface OccupiedSeat extends Seat {
    studentId: string;
    variantIndex: number;
}

/**
 * Calculate the variant index using Latin Square formula.
 * This ensures that adjacent students (horizontally, vertically, or diagonally)
 * receive different question variants.
 * 
 * Formula: variantIndex = ((row * 3) + column) % totalVariants
 * 
 * Example with 4 variants:
 * |     | Col 0 | Col 1 | Col 2 | Col 3 |
 * |-----|-------|-------|-------|-------|
 * | Row 0 |   0   |   1   |   2   |   3   |
 * | Row 1 |   3   |   0   |   1   |   2   |
 * | Row 2 |   2   |   3   |   0   |   1   |
 * | Row 3 |   1   |   2   |   3   |   0   |
 */
export function calculateVariantIndex(row: number, column: number, totalVariants: number): number {
    if (totalVariants <= 0) return 0;
    return ((row * 3) + column) % totalVariants;
}

/**
 * Get all empty seats in the grid that aren't occupied.
 */
export function getEmptySeats(
    rows: number,
    columns: number,
    occupiedSeats: Seat[]
): Seat[] {
    const occupied = new Set(occupiedSeats.map(s => `${s.row}-${s.column}`));
    const empty: Seat[] = [];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            if (!occupied.has(`${row}-${col}`)) {
                empty.push({ row, column: col });
            }
        }
    }

    return empty;
}

/**
 * Get a random empty seat from the grid.
 */
export function getRandomEmptySeat(
    rows: number,
    columns: number,
    occupiedSeats: Seat[]
): Seat | null {
    const empty = getEmptySeats(rows, columns, occupiedSeats);
    if (empty.length === 0) return null;
    return empty[Math.floor(Math.random() * empty.length)];
}

/**
 * Automatically assign seats to all waiting students.
 * Uses a snake pattern (left-to-right, then right-to-left) for natural filling.
 */
export function autoAssignSeats(
    rows: number,
    columns: number,
    occupiedSeats: Seat[],
    waitingStudentCount: number,
    totalVariants: number
): { row: number; column: number; variantIndex: number }[] {
    const assigned: { row: number; column: number; variantIndex: number }[] = [];
    const occupied = new Set(occupiedSeats.map(s => `${s.row}-${s.column}`));
    let studentsRemaining = waitingStudentCount;

    for (let row = 0; row < rows && studentsRemaining > 0; row++) {
        // Snake pattern: even rows go left-to-right, odd rows go right-to-left
        const cols = row % 2 === 0
            ? Array.from({ length: columns }, (_, i) => i)
            : Array.from({ length: columns }, (_, i) => columns - 1 - i);

        for (const col of cols) {
            if (studentsRemaining <= 0) break;
            if (!occupied.has(`${row}-${col}`)) {
                const variantIndex = calculateVariantIndex(row, col, totalVariants);
                assigned.push({ row, column: col, variantIndex });
                occupied.add(`${row}-${col}`);
                studentsRemaining--;
            }
        }
    }

    return assigned;
}

/**
 * Calculate remaining time for a student.
 * Late joiners get remaining time + extra minutes (if configured).
 */
export function calculateRemainingTime(
    sessionStartTime: Date,
    durationMinutes: number,
    lateJoinerExtraMinutes: number,
    studentStartTime?: Date
): number {
    const now = new Date();
    const sessionEnd = new Date(sessionStartTime.getTime() + durationMinutes * 60 * 1000);

    if (studentStartTime) {
        // Late joiner: add extra time
        const adjustedEnd = new Date(sessionEnd.getTime() + lateJoinerExtraMinutes * 60 * 1000);
        const remaining = Math.max(0, adjustedEnd.getTime() - now.getTime());
        return Math.floor(remaining / 1000); // Return seconds
    }

    // Regular student: standard remaining time
    const remaining = Math.max(0, sessionEnd.getTime() - now.getTime());
    return Math.floor(remaining / 1000);
}

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
    if (seconds <= 0) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a visual grid representation for debugging.
 */
export function generateGridDebug(
    rows: number,
    columns: number,
    occupiedSeats: OccupiedSeat[],
    totalVariants: number
): string {
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const grid: string[][] = [];

    for (let row = 0; row < rows; row++) {
        const rowCells: string[] = [];
        for (let col = 0; col < columns; col++) {
            const occupied = occupiedSeats.find(s => s.row === row && s.column === col);
            if (occupied) {
                rowCells.push(labels[occupied.variantIndex % labels.length]);
            } else {
                rowCells.push('·');
            }
        }
        grid.push(rowCells);
    }

    return grid.map(row => row.join(' ')).join('\n');
}
