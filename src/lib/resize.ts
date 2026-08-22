// A menu with 30 unscaled phone photos is tens of megabytes and never loads on
// café wifi, so the browser downscales before upload. Kept pure and separate
// from the canvas code so the maths is testable in Node.
export const MAX_IMAGE_EDGE = 1200;

export function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): {width: number; height: number} {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return {width, height};
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}
