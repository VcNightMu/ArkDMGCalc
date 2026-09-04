// element-calc 模拟器验证：余 S2 场景手算对照
import { simulateSkillTimeline, steadyElementDps, ELEMENT_BREAK, EP_CAPACITY, simulateEp } from '../../src/frontend/js/element-calc.js';

let pass = 0, fail = 0;
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name); } };

// ===== simulateEp 基础：神经每秒 54.5/s（响石 606×0.09），normal 容量 1000 =====
{
  const evs = []; for (let i = 1; i <= 30; i++) evs.push({ t: i, ep: 54.54 });
  const r = simulateEp('normal', 'sanity', evs);
  // 1000/54.54 = 18.34 → 第19跳(t=19) 爆条 6000，冷却 10s → t=29 起恢复，t=29..30 施加 109<1000 不爆
  check('响石常态爆条第19秒', r.breaks.length === 1 && near(r.breaks[0].t, 19));
  check('响石神经爆条6000', near(r.totalDmg, 6000));
  // 稳态：breakAt=19(第19跳t=19? n=19 → t=(19-1)×1=18)... 修正：steadyElementDps breakAt=(n-1)*interval
  const st = steadyElementDps('normal', 'sanity', 54.54, 1);
  check('稳态 breakAt=18s', near(st.breakAt, 18), 0.01);
  check('稳态周期=18+10=28s', near(st.cycleSec, 28), 0.01);
  check('稳态 avgDps=6000/28', near(st.avgDps, 6000 / 28), 0.01);
}

// ===== 余 S2（专三 atk+290%，dur20）：开技后攻击力=3.9×面板。每击法伤普攻间隔1.6，天赋每秒0.4×atk法伤+0.12×atk灼燃 =====
{
  const atk = 715; // E2 满级 685+30 信赖
  const skillAtk = atk * 3.9; // 2145*... 715*3.9=2788.5
  const res = 50, def = 600;
  const dur = 20;
  // 攻击流：12 击法伤 (t=1.6..19.2)
  // 灼燃流：每秒 0.12×skillAtk=334.62 → 第3跳 t=3 爆 → 冷却至13 → t=13..15 → t=15 第二爆 → 冷却至25>20
  // 天赋法伤流：每秒 0.4×skillAtk=1115.4 arts（不吃？吃res，灼燃窗口内吃减抗）
  const r = simulateSkillTimeline({
    grade: 'normal', duration: dur, enemy: { def, res },
    attacks: [{ type: 'arts', atk: skillAtk, interval: 1.6 }],
    dots: [
      { type: 'arts', atk: skillAtk, dmgMul: 0.4, interval: 1 },          // 天赋法伤 0.4×atk/s
      { type: null, atk: skillAtk, epMul: 0.12, el: 'fire', interval: 1 }, // 灼燃损伤 0.12×atk/s
    ],
  });
  check('余S2 爆条2次(t=3,t=15)', r.breaks === 2, 0);
  check('元素伤害=2×7000', near(r.element, 14000));
  // 手算法伤：12击普攻 + 20跳天赋法伤，窗口内res=30
  // 灼燃窗口 [3,13) [15,20)：普攻 t=1.6(50) 3.2..12.8(30,共7) 14.4(50) 16,17.6,19.2(30,3) → 窗口内10击
  const arts1 = (a) => a * (100 - 50) / 100, arts2 = (a) => a * (100 - 30) / 100;
  let expArts = 0;
  const hitT = [1.6, 3.2, 4.8, 6.4, 8, 9.6, 11.2, 12.8, 14.4, 16, 17.6, 19.2];
  for (const t of hitT) expArts += ((t >= 3 && t < 13) || (t >= 15 && t < 25)) ? arts2(skillAtk) : arts1(skillAtk);
  // 天赋每秒法伤 t=1..20：t=3..12(10跳 30) t=13,14(50) t=15..20(6跳? t=15..20 含20, <25 → 30) 即 15,16..20=6跳 30
  for (let t = 1; t <= 20; t++) expArts += ((t >= 3 && t < 13) || (t >= 15)) ? arts2(skillAtk * 0.4) : arts1(skillAtk * 0.4);
  check('余S2 法伤总伤=手算', near(r.arts, expArts, 1));
  check('余S2 物理0', r.physical === 0);
  // 打印供核对
  console.log('余S2 模拟结果:', JSON.stringify(r));
}

// ===== 珊比侵蚀：每击 0.1×701=70.1/1.6s，CD 折算 5s =====
{
  const atk = 701;
  const epPerHit = 0.1 * atk; // 70.1
  const st = steadyElementDps('normal', 'water', epPerHit, 1.6, 5);
  // n=ceil(1000/70.1)=15 → breakAt=(15-1)*1.6=22.4 → cycle 27.4 → 5000/27.4
  check('珊比 15击爆条 breakAt=22.4s', near(st.breakAt, 22.4));
  check('珊比 周期 22.4+5=27.4s', near(st.cycleSec, 27.4));
  check('珊比 常态元素DPS=5000/27.4', near(st.avgDps, 5000 / 27.4, 0.01));
}

console.log(`\n模拟器验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
