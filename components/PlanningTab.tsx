
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Rocket, 
  Settings2, 
  PieChart, 
  Factory, 
  Gift, 
  BarChart3, 
  Download,
  ShieldCheck,
  RefreshCcw,
  Info,
  CalendarDays
} from 'lucide-react';
import { AppState, RestockPlanItem } from '../types';

interface Props {
  appState: AppState;
}

const PlanningTab: React.FC<Props> = ({ appState }) => {
  // Parameters
  const [shippingDays] = useState(30);
  const [riskDays, setRiskDays] = useState(0);
  const [freqDays, setFreqDays] = useState(7);
  const [capacityIdx, setCapacityIdx] = useState(1.0);
  const [trendCoeff, setTrendCoeff] = useState(1.0);
  const [promoLevel, setPromoLevel] = useState(1.0);
  
  const [overseasAllocRate, setOverseasAllocRate] = useState(1.0);
  const [influencerRate, setInfluencerRate] = useState(0.15);
  const [afterSaleRate, setAfterSaleRate] = useState(0.05);
  const compensateRate = useMemo(() => influencerRate + afterSaleRate, [influencerRate, afterSaleRate]);
  
  const [laRatio, setLaRatio] = useState(40);
  const [nyRatio, setNyRatio] = useState(35);
  const [officialRatio, setOfficialRatio] = useState(25);

  const [results, setResults] = useState<RestockPlanItem[]>([]);
  const [summary, setSummary] = useState({ adjusted: 0, stock: 0, net: 0, cover: 37, cycle: 0 });

  const handleRatioChange = (id: 'la' | 'ny' | 'official', newValue: number) => {
    let ratios = { la: laRatio, ny: nyRatio, official: officialRatio };
    const oldValue = ratios[id];
    const diff = newValue - oldValue;
    const others = (['la', 'ny', 'official'] as const).filter(k => k !== id);
    const sumOthers = ratios[others[0]] + ratios[others[1]];
    ratios[id] = newValue;
    if (sumOthers > 0) {
      const adj0 = Math.round(diff * (ratios[others[0]] / sumOthers));
      const adj1 = diff - adj0;
      ratios[others[0]] = Math.max(0, ratios[others[0]] - adj0);
      ratios[others[1]] = Math.max(0, ratios[others[1]] - adj1);
    } else {
      const remaining = 100 - newValue;
      ratios[others[0]] = Math.floor(remaining / 2);
      ratios[others[1]] = remaining - ratios[others[0]];
    }
    const currentTotal = ratios.la + ratios.ny + ratios.official;
    if (currentTotal !== 100) {
      const fix = 100 - currentTotal;
      if (ratios[others[0]] >= ratios[others[1]]) ratios[others[0]] += fix;
      else ratios[others[1]] += fix;
    }
    setLaRatio(ratios.la);
    setNyRatio(ratios.ny);
    setOfficialRatio(ratios.official);
  };

  const calculate = useCallback(() => {
    if (Object.keys(appState.sales).length === 0) {
      alert('⚠️ 请先上传销售数据！');
      return;
    }

    const coverDays = shippingDays + riskDays + freqDays;
    const multipliers = trendCoeff * promoLevel * capacityIdx;
    
    const prepData: Record<string, { daily: number }> = {};
    Object.entries(appState.sales).forEach(([sellerSku, data]) => {
      const prepSku = appState.mapping[sellerSku];
      if (!prepSku) return;
      if (!prepData[prepSku]) prepData[prepSku] = { daily: 0 };
      prepData[prepSku].daily += data.weightedAvg;
    });

    const reverseMapping: Record<string, string[]> = {};
    Object.entries(appState.mapping).forEach(([seller, stock]) => {
      if (!reverseMapping[stock]) reverseMapping[stock] = [];
      reverseMapping[stock].push(seller);
    });

    const planResults: RestockPlanItem[] = [];
    let grandAdjusted = 0, grandStock = 0, grandNet = 0, grandCycle = 0;

    Object.entries(prepData).forEach(([prepSku, data]) => {
      const baseDemand = data.daily * coverDays;
      const adjustedDemand = baseDemand * multipliers;
      
      const cycleDemand = Math.ceil(data.daily * freqDays * multipliers * (1 + compensateRate));
      
      const ov = appState.overseas[prepSku] || { la: { available: 0, transit: 0 }, ny: { available: 0, transit: 0 } };
      const official = appState.officialInventory[prepSku] || { available: 0, transit: 0 };
      
      const rawOverseasTotal = ov.la.available + ov.la.transit + ov.ny.available + ov.ny.transit;
      const effectiveOverseasStock = rawOverseasTotal * overseasAllocRate;
      const effectiveOfficialStock = official.available + official.transit;
      const totalStock = Math.floor(effectiveOverseasStock + effectiveOfficialStock);
      
      const gap = Math.max(0, adjustedDemand - totalStock);
      const netDemand = Math.ceil(gap * (1 + compensateRate));
      
      // 计算分仓量
      const laQty = Math.floor(netDemand * (laRatio / 100));
      const nyQty = Math.floor(netDemand * (nyRatio / 100));
      const fbtQty = netDemand - laQty - nyQty;

      // 新增：计算周期基准的分仓显示
      const cycleLa = Math.floor(cycleDemand * (laRatio / 100));
      const cycleNy = Math.floor(cycleDemand * (nyRatio / 100));
      const cycleFbt = cycleDemand - cycleLa - cycleNy;
      
      if (netDemand > 0 || cycleDemand > 0) {
        planResults.push({
          restockSku: prepSku,
          sellerSkus: reverseMapping[prepSku]?.join(', ') || '-',
          daily: data.daily,
          baseDemand: Math.ceil(baseDemand),
          adjustedDemand: Math.ceil(adjustedDemand),
          cycleDemand,
          totalStock,
          gap: Math.ceil(gap),
          netDemand,
          laQty,
          nyQty,
          fbtQty,
          cycleLa,
          cycleNy,
          cycleFbt
        });

        grandAdjusted += Math.ceil(adjustedDemand);
        grandStock += totalStock;
        grandNet += netDemand;
        grandCycle += cycleDemand;
      }
    });

    planResults.sort((a, b) => b.netDemand - a.netDemand);
    setResults(planResults);
    setSummary({ adjusted: grandAdjusted, stock: grandStock, net: grandNet, cover: coverDays, cycle: grandCycle });
  }, [appState, shippingDays, riskDays, freqDays, trendCoeff, promoLevel, capacityIdx, compensateRate, laRatio, nyRatio, officialRatio, overseasAllocRate]);

  const exportExcel = () => {
    if (results.length === 0) return;
    const data = results.map(r => ({
      '备货 SKU': r.restockSku,
      '最终建议备货量': r.netDemand,
      'LA 仓补货': r.laQty,
      'LA 周期基准': r.cycleLa,
      'NY 仓补货': r.nyQty,
      'NY 周期基准': r.cycleNy,
      '官方仓补货': r.fbtQty,
      '官方周期基准': r.cycleFbt
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "备货计划");
    XLSX.writeFile(wb, `Replenishment_Plan_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Parameters Controls */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-6">
              <Settings2 className="w-4 h-4 text-blue-600" /> 基础策略参数
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">备货周期 (下单频率)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: '每周一次', v: 7 }, { l: '双周一次', v: 14 }, { l: '每月一次', v: 30 }, { l: '极速补货', v: 3 }
                  ].map(f => (
                    <button 
                      key={f.v}
                      onClick={() => setFreqDays(f.v)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${freqDays === f.v ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'}`}
                    >
                      {f.l} ({f.v}d)
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">海外仓可用分配率</label>
                  <span className="text-sm font-black text-blue-600 mono">{Math.round(overseasAllocRate * 100)}%</span>
                </div>
                <div className="flex gap-4 items-center">
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    value={overseasAllocRate} 
                    onChange={(e) => setOverseasAllocRate(parseFloat(e.target.value))}
                    className="flex-grow h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">物流延期风险</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { l: '正常', v: 0, ac: 'bg-green-600' },
                    { l: '轻微', v: 7, ac: 'bg-yellow-500' },
                    { l: '显著', v: 15, ac: 'bg-orange-600' },
                    { l: '严重', v: 30, ac: 'bg-red-600' }
                  ].map(r => (
                    <button 
                      key={r.v}
                      onClick={() => setRiskDays(r.v)}
                      className={`flex flex-col items-center p-2 rounded-xl border transition-all ${riskDays === r.v ? `${r.ac} text-white border-transparent scale-105 shadow-lg` : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      <span className="text-xs font-black">{r.l}</span>
                      <span className="text-[10px] opacity-80">+{r.v}d</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-6">
              <Factory className="w-4 h-4 text-purple-600" /> 产能与市场趋势
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">
                  <span>工厂产能指数</span>
                  <span className="text-blue-600">{capacityIdx.toFixed(1)}x</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0.3, 0.8, 1.0, 1.5, 2.0].map(v => (
                    <button 
                      key={v}
                      onClick={() => setCapacityIdx(v)}
                      className={`py-1.5 rounded-lg text-[10px] font-black border transition-all ${capacityIdx === v ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                    >
                      {v}x
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">
                  <span>季节/趋势系数</span>
                  <span className="text-blue-600 font-black">{trendCoeff.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.3" max="3.0" step="0.1" value={trendCoeff} 
                  onChange={(e) => setTrendCoeff(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">促销活动等级</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={promoLevel}
                  onChange={(e) => setPromoLevel(parseFloat(e.target.value))}
                >
                  <option value="1.0">常规销售模式 (1.0x)</option>
                  <option value="1.3">A 级节点活动 (1.3x)</option>
                  <option value="1.8">S 级核心大促 (1.8x)</option>
                  <option value="2.5">SS 级年度黑五 (2.5x)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-6">
              <Gift className="w-4 h-4 text-amber-400" /> 补偿系数配置
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-2 tracking-tighter">
                  <span>达人样品</span>
                  <span className="text-blue-400 font-black">{Math.round(influencerRate * 100)}%</span>
                </div>
                <input 
                  type="range" min="0" max="0.5" step="0.01" value={influencerRate} 
                  onChange={(e) => setInfluencerRate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-2 tracking-tighter">
                  <span>售后补偿</span>
                  <span className="text-orange-400 font-black">{Math.round(afterSaleRate * 100)}%</span>
                </div>
                <input 
                  type="range" min="0" max="0.3" step="0.01" value={afterSaleRate} 
                  onChange={(e) => setAfterSaleRate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="flex items-center gap-3 text-xs">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-black">∑</div>
                  <div>
                    <p className="font-bold text-slate-200 text-[10px]">
                      综合需求系数: <span className="text-blue-400">{(trendCoeff * promoLevel * capacityIdx * (1 + compensateRate)).toFixed(2)}x</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <PieChart className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-800">分仓分配比例 (针对最终缺口)</h3>
          </div>
          <div className="text-xs font-black px-4 py-2 bg-slate-100 rounded-full text-slate-600 uppercase tracking-widest border border-slate-200">
            权重总和: <span className="text-blue-600 font-black">{laRatio + nyRatio + officialRatio}%</span>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-12 mb-10">
          {[
            { id: 'la', l: 'LA 洛杉矶总仓', v: laRatio, color: 'accent-blue-600', text: 'text-blue-600' },
            { id: 'ny', l: 'NY 纽约总仓', v: nyRatio, color: 'accent-indigo-600', text: 'text-indigo-600' },
            { id: 'official', l: '官方自营仓', v: officialRatio, color: 'accent-purple-600', text: 'text-purple-600' }
          ].map(r => (
            <div key={r.id} className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">{r.l}</span>
                <span className={`text-4xl font-black mono ${r.text}`}>{r.v}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={r.v} 
                onChange={(e) => handleRatioChange(r.id as any, parseInt(e.target.value))}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-100 ${r.color}`}
              />
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={calculate}
        className="w-full py-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white rounded-3xl font-black text-xl shadow-2xl hover:shadow-blue-500/40 transform hover:-translate-y-1 transition-all flex items-center justify-center gap-4 group active:scale-95"
      >
        <Rocket className="w-8 h-8 group-hover:animate-bounce" />
        立即生成智能备货决策计划
      </button>

      {results.length > 0 && (
        <div className="space-y-8 animate-in zoom-in-95 fade-in duration-500">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { l: '安全覆盖天数', v: summary.cover, u: 'DAYS', c: 'bg-white border-slate-200' },
              { l: '智能周期基准', v: summary.cycle, u: 'PCS', c: 'bg-indigo-50 border-indigo-100', icon: RefreshCcw, tip: `即${freqDays}天的加权销量参考` },
              { l: '有效抵扣库存', v: summary.stock, u: 'PCS', c: 'bg-amber-50 border-amber-100' },
              { l: '最终建议备货量', v: summary.net, u: 'PCS', c: 'bg-green-50 border-green-100', highlight: true }
            ].map((s, i) => (
              <div key={i} className={`p-4 rounded-3xl border shadow-sm ${s.c}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.l}</p>
                </div>
                <p className={`text-2xl font-black mono ${s.highlight ? 'text-green-700' : 'text-slate-800'}`}>
                  {s.v.toLocaleString()} <span className="text-[10px] font-bold opacity-30">{s.u}</span>
                </p>
                {s.tip && <p className="text-[8px] text-slate-400 mt-1 leading-tight font-medium">{s.tip}</p>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-200">
                   <CalendarDays className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">备货明细决策表</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-md font-bold">最终备货量</span> 
                    = 本期必须下单量 (填补安全缺口) | 
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md font-bold">{freqDays}d 周期基准</span> 
                    = 维持日常周转的参考量
                  </p>
                </div>
              </div>
              <button 
                onClick={exportExcel}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-black shadow-lg transition-all active:scale-95"
              >
                <Download className="w-5 h-5" /> 导出 EXCEL
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-4 text-left">备货 SKU</th>
                    <th className="px-3 py-4 text-right">有效抵扣库存</th>
                    <th className="px-4 py-4 text-center bg-slate-900 text-white rounded-t-xl">最终建议补货 (Gap)</th>
                    <th className="px-4 py-4 text-right bg-blue-50/50 text-blue-600">LA 补货 <span className="block text-[8px] opacity-60">({freqDays}d 基准)</span></th>
                    <th className="px-4 py-4 text-right bg-indigo-50/50 text-indigo-600">NY 补货 <span className="block text-[8px] opacity-60">({freqDays}d 基准)</span></th>
                    <th className="px-4 py-4 text-right bg-purple-50/50 text-purple-600">官方 补货 <span className="block text-[8px] opacity-60">({freqDays}d 基准)</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-4">
                        <div className="font-black text-slate-900 mono text-xs tracking-tighter truncate">{r.restockSku}</div>
                        <div className="text-[8px] text-slate-400 font-medium truncate mt-0.5">
                          {r.sellerSkus}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-slate-500">
                        {r.totalStock.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center bg-slate-50/30">
                        <div className="font-black text-slate-900 text-sm tracking-tight">{r.netDemand.toLocaleString()}</div>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1 rounded">
                            {r.cycleDemand.toLocaleString()} ({freqDays}d)
                          </span>
                          {r.netDemand > r.cycleDemand ? (
                            <span className="text-[8px] font-black text-red-500 px-1 border border-red-200 rounded uppercase">追货</span>
                          ) : (
                            <span className="text-[8px] font-black text-green-500 px-1 border border-green-200 rounded uppercase">稳态</span>
                          )}
                        </div>
                      </td>
                      {/* LA 分仓展示：上方为总补货，下方为7天基准 */}
                      <td className="px-4 py-4 text-right bg-blue-50/5">
                        <div className="font-black text-blue-700 text-sm">{r.laQty.toLocaleString()}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5 border-t border-blue-100 pt-0.5">
                          {r.cycleLa.toLocaleString()} <span className="text-[7px]">REF</span>
                        </div>
                      </td>
                      {/* NY 分仓展示 */}
                      <td className="px-4 py-4 text-right bg-indigo-50/5">
                        <div className="font-black text-indigo-700 text-sm">{r.nyQty.toLocaleString()}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5 border-t border-indigo-100 pt-0.5">
                          {r.cycleNy.toLocaleString()} <span className="text-[7px]">REF</span>
                        </div>
                      </td>
                      {/* 官方 分仓展示 */}
                      <td className="px-4 py-4 text-right bg-purple-50/5">
                        <div className="font-black text-purple-700 text-sm">{r.fbtQty.toLocaleString()}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5 border-t border-purple-100 pt-0.5">
                          {r.cycleFbt.toLocaleString()} <span className="text-[7px]">REF</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {results.length === 0 && (
        <div className="py-24 flex flex-col items-center justify-center text-slate-300 bg-white rounded-3xl border border-slate-100 shadow-inner">
          <BarChart3 className="w-20 h-20 mb-4 opacity-5 text-slate-900" />
          <p className="font-black text-sm uppercase tracking-[0.2em] text-slate-400">请调整备货策略参数并生成计划</p>
        </div>
      )}
    </div>
  );
};

export default PlanningTab;
