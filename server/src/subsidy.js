/** Mirrors GetBlockSubsidy in nadcab-coind for the chain file's subsidy rules. */
export function subsidyRules(chain) {
  const s = chain.subsidy || {};
  return {
    initial: BigInt(s.initial ?? 5_000_000_000),
    interval: Number(s.halvingInterval ?? 210_000),
    maxSteps: Number(s.maxHalvings ?? 64),
    percent: Number(s.reductionPercent ?? 50),
    tail: BigInt(s.tail ?? 0),
    premine: BigInt(s.premine ?? 0),
  };
}

export function subsidyAt(height, rules) {
  if (height === 1 && rules.premine > 0n) return rules.premine;
  const steps = Math.min(rules.interval > 0 ? Math.floor(height / rules.interval) : 0, rules.maxSteps);
  let value = rules.initial;
  if (rules.percent === 50) {
    value = steps >= 64 ? 0n : value >> BigInt(steps);
  } else {
    const keep = BigInt(100 - rules.percent);
    for (let i = 0; i < steps && value > 0n; i += 1) value = (value / 100n) * keep + ((value % 100n) * keep) / 100n;
  }
  return value > rules.tail ? value : rules.tail;
}

/** The next height where the block reward changes, or null once it is flat for good. */
export function nextReduction(height, rules) {
  if (rules.interval <= 0) return null;
  const current = subsidyAt(Math.max(height, 2), rules);
  let step = Math.floor(height / rules.interval) + 1;
  for (let guard = 0; guard < 4 && step <= rules.maxSteps; guard += 1, step += 1) {
    const at = step * rules.interval;
    const reward = subsidyAt(at, rules);
    if (reward !== current) return { height: at, reward };
  }
  return null;
}
