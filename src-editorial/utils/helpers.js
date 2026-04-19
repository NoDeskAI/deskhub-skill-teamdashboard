let _pid = 10;
export function nPid() { return "p" + (_pid++); }

let _vid = 100;
export function nVid() { return "v" + (_vid++); }

let _did = 10;
export function nDid() { return "d" + (_did++); }

export function td() {
  const d = new Date();
  return String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/**
 * 自动推断进行中工单的子阶段
 * @param {object} plan - 工单对象
 * @param {array} activeDims - 启用的评测维度列表
 * @returns {"collecting"|"evaluating"|"finalizing"}
 */
export function getPhase(plan, activeDims) {
  if (!plan.variants || plan.variants.length === 0) return "collecting";

  const dimIds = activeDims.map(d => d.id);
  const allScored = plan.variants.every(v => {
    if (!v.scores || v.scores.length === 0) return false;
    return dimIds.every(did => v.scores.some(s => s.dimId === did));
  });

  return allScored ? "finalizing" : "evaluating";
}

/**
 * 计算方案在各维度的均分
 * 对每个维度取该方案所有测试员最新一次打分的平均值，再对维度取平均
 * @param {object} variant - 方案对象
 * @param {array} activeDims - 启用的评测维度列表
 * @returns {number} 均分，无评分时返回 0
 */
export function avgScore(variant, activeDims) {
  if (!variant.scores || variant.scores.length === 0 || activeDims.length === 0) return 0;

  const dimScores = activeDims.map(d => {
    // 找出所有测试员对该维度的评分
    const entries = variant.scores.filter(s => s.dimId === d.id);
    if (entries.length === 0) return null;

    // 按测试员分组，取每人最新一次
    const byTester = {};
    entries.forEach(s => {
      if (!byTester[s.tester] || s.date > byTester[s.tester].date) {
        byTester[s.tester] = s;
      }
    });

    const values = Object.values(byTester).map(s => s.value);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }).filter(v => v !== null);

  if (dimScores.length === 0) return 0;
  return dimScores.reduce((a, b) => a + b, 0) / dimScores.length;
}
