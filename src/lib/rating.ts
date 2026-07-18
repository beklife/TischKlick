export type RatingBranch = 'google' | 'private';

// The single source of the gating rule. Do not re-implement elsewhere.
export function ratingBranch(rating: number): RatingBranch {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new RangeError(`Ungültige Bewertung: ${rating}`);
  }
  return rating >= 4 ? 'google' : 'private';
}
