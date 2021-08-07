function bestSquare(width, height, numSquares) {
  let lo = 0.0;
  let hi = Math.max(width, height);

  while (Math.abs(hi - lo) > 0.000001) {
    let mid = (lo + hi) / 2.0;
    let midval = Math.floor(width / mid) * Math.floor(height / mid);

    if (midval >= numSquares) {
      lo = mid;
    } else if (midval < numSquares) {
      hi = mid;
    }
  }
  return Math.min(
    width / Math.floor(width / lo),
    height / Math.floor(height / lo)
  );
}

export { bestSquare };
