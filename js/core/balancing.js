'use strict';
/*
 * Soft coverage correction for finite, meaningful question categories.
 * Independent per category (alphabet letters, denominators, etc.).
 * Never enforces a fixed rotation and never reads correctness/FEVER scores.
 * Purely cosmetic RNG (choice order, confetti, numeric distractors) is untouched.
 */
function balancedPick(options, group, keyOf = value => String(value)) {
  if (!Array.isArray(options) || options.length === 0) throw Error('balancedPick requires candidates');
  if (options.length === 1) return options[0];
  if (!state.balanceStats || typeof state.balanceStats !== 'object') state.balanceStats = {};
  const bucket = state.balanceStats[group] || (state.balanceStats[group] = {counts:{},recent:[]});
  if (!bucket.counts || typeof bucket.counts !== 'object') bucket.counts = {};
  if (!Array.isArray(bucket.recent)) bucket.recent = [];

  // One stable key per candidate; do not use this helper with repeated keys.
  const keys = options.map(v => String(keyOf(v)));
  const counts = keys.map(k => Math.max(0, Number(bucket.counts[k]) || 0));
  const total = counts.reduce((a,b) => a+b, 0);
  const expected = total / options.length;

  // Correction starts gently and progressively gains strength with exposure.
  // Count gaps create a bounded probability boost (NOT a mandatory next item).
  const strength = 0.16 + 0.72 * (1 - Math.exp(-total / (options.length * 4)));
  const weights = counts.map((n,i) => {
    const gap = Math.max(-1.6, Math.min(1.6, strength * (expected-n)));
    let w = Math.exp(gap);
    if (bucket.recent[0] === keys[i]) w *= 0.42;
    else if (bucket.recent[1] === keys[i]) w *= 0.78;
    return w;
  });
  const sum = weights.reduce((a,b) => a+b, 0);
  let r = Math.random() * sum;
  let chosen = weights.length-1;
  for (let i=0; i<weights.length; i++) {
    r -= weights[i];
    if (r < 0) { chosen = i; break; }
  }
  const key = keys[chosen];
  bucket.counts[key] = counts[chosen] + 1;
  bucket.recent = [key, ...bucket.recent.filter(k=>k!==key)].slice(0,2);
  return options[chosen];
}
