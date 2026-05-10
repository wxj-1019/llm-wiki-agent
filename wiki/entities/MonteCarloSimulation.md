---
title: "MonteCarloSimulation"
type: entity
tags: [backtest, simulation, risk]
sources: [backtest-engine]
last_updated: 2026-05-09
---

[[MonteCarloSimulation|蒙特卡洛模拟]] 在 [[backtest-engine|回测引擎]] 中支持 4 种模拟方法：bootstrap（有放回抽样）、geometric_bm（几何布朗运动）、jump_diffusion（跳跃扩散模型）、regime_switching（状态切换模型）。输出收益分布、VaR、CVaR、破产概率等风险指标。
