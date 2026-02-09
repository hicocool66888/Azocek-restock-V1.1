
import React from 'react';
import * as XLSX from 'xlsx';
import { Upload, TrendingUp, Calendar, Info, BarChart } from 'lucide-react';
import { SalesData } from '../types';

interface Props {
  mapping: Record<string, string>;
  sales: Record<string, SalesData>;
  weights: { recent: number; middle: number; early: number };
  onUpdate: (sales: Record<string, SalesData>) => void;
  onUpdateWeights: (weights: { recent: number; middle: number; early: number }) => void;
}

const DAYS_PER_MONTH = 30;

const SalesTab: React.FC<Props> = ({ mapping, sales, weights, onUpdate, onUpdateWeights }) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (Object.keys(mapping).length === 0) {
      alert('⚠️ 请先上传映射表！');
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (rows.length === 0) return;

        const newSales: Record<string, SalesData> = {};
        const headers = Object.keys(rows[0]);
        
        const skuCol = headers.find(h => h.toLowerCase().includes('sku')) || headers[0];
        const monthCols = headers.filter(h => /^\d{4}[-/]\d{1,2}$/.test(h.toString().trim()));
        
        if (monthCols.length < 1) {
          alert('❌ 未找到符合日期格式的月份列 (例如: 2024-01)');
          return;
        }

        monthCols.sort((a, b) => {
          const parse = (s: string) => {
            const parts = s.split(/[-/]/);
            return parseInt(parts[0]) * 12 + parseInt(parts[1]);
          };
          return parse(b) - parse(a);
        });

        const activeMonths = monthCols.slice(0, 3);
        const [m0, m1, m2] = activeMonths;

        rows.forEach(row => {
          const sku = row[skuCol]?.toString().trim();
          if (!sku || !mapping[sku]) return;

          const q0 = parseFloat(row[m0]) || 0;
          const q1 = parseFloat(row[m1]) || 0;
          const q2 = parseFloat(row[m2] || 0) || 0;

          if (!newSales[sku]) {
            newSales[sku] = {
              sellerSku: sku,
              months: { recent: q0, middle: q1, early: q2 },
              monthNames: [m0, m1, m2 || 'N/A'],
              daily: {
                recent: q0 / DAYS_PER_MONTH,
                middle: q1 / DAYS_PER_MONTH,
                early: q2 / DAYS_PER_MONTH
              },
              weightedAvg: 0
            };
          } else {
            newSales[sku].months.recent += q0;
            newSales[sku].months.middle += q1;
            newSales[sku].months.early += q2;
            newSales[sku].daily = {
              recent: newSales[sku].months.recent / DAYS_PER_MONTH,
              middle: newSales[sku].months.middle / DAYS_PER_MONTH,
              early: newSales[sku].months.early / DAYS_PER_MONTH
            };
          }
        });

        Object.keys(newSales).forEach(sku => {
          const d = newSales[sku];
          d.weightedAvg = (d.daily.recent * weights.recent) + (d.daily.middle * weights.middle) + (d.daily.early * weights.early);
        });

        onUpdate(newSales);
        alert(`✅ 成功导入 ${Object.keys(newSales).length} 个匹配 SKU 的销售数据`);
      } catch (err) {
        alert('❌ 导入失败，请检查文件格式');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 联动平衡逻辑，确保权重总和为 100%
  const handleWeightChangeBalanced = (id: 'recent' | 'middle' | 'early', newValuePercent: number) => {
    // 将当前的 0-1 权重转为 0-100 整数
    const currentWeights = {
      recent: Math.round(weights.recent * 100),
      middle: Math.round(weights.middle * 100),
      early: Math.round(weights.early * 100)
    };

    const oldValue = currentWeights[id];
    const diff = newValuePercent - oldValue;
    
    // 找出另外两个需要调整的权重
    const others = (['recent', 'middle', 'early'] as const).filter(k => k !== id);
    const sumOthers = currentWeights[others[0]] + currentWeights[others[1]];

    currentWeights[id] = newValuePercent;

    if (sumOthers > 0) {
      // 按比例分配差值
      const adj0 = Math.round(diff * (currentWeights[others[0]] / sumOthers));
      const adj1 = diff - adj0;
      
      currentWeights[others[0]] = Math.max(0, currentWeights[others[0]] - adj0);
      currentWeights[others[1]] = Math.max(0, currentWeights[others[1]] - adj1);
    } else {
      // 如果其他两个为 0，则平分剩余部分
      const remaining = 100 - newValuePercent;
      currentWeights[others[0]] = Math.floor(remaining / 2);
      currentWeights[others[1]] = remaining - currentWeights[others[0]];
    }

    // 最后的微调，确保总和精确等于 100
    const finalSum = currentWeights.recent + currentWeights.middle + currentWeights.early;
    if (finalSum !== 100) {
      const fix = 100 - finalSum;
      // 补偿给最大的那个“其他”权重
      if (currentWeights[others[0]] >= currentWeights[others[1]]) {
        currentWeights[others[0]] += fix;
      } else {
        currentWeights[others[1]] += fix;
      }
    }

    // 更新状态（转回 0-1 比例）
    onUpdateWeights({
      recent: currentWeights.recent / 100,
      middle: currentWeights.middle / 100,
      early: currentWeights.early / 100
    });
  };

  const salesList = Object.values(sales);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-blue-600" /> 往期三个月销售分析
            </h2>
            <p className="text-slate-500 mt-1">导入往期三个月销售额，通过加权平均（Recent/Middle/Early）计算每日需求。</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <label className="group relative flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-all">
              <div className="p-4 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform text-blue-600">
                <Upload className="w-8 h-8" />
              </div>
              <p className="mt-4 text-sm font-bold text-slate-700">导入月销售 Excel</p>
              <input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileUpload} />
            </label>

            <div className="p-6 bg-slate-900 rounded-2xl text-white shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">三阶段权重系数</h3>
                <span className="text-[10px] font-black px-2 py-0.5 bg-blue-600/30 text-blue-400 rounded-full border border-blue-500/20 uppercase tracking-widest">
                  总计 100%
                </span>
              </div>
              <div className="space-y-6">
                {[
                  { id: 'recent' as const, label: '最近月 (Recent)', weight: weights.recent, color: 'accent-blue-500' },
                  { id: 'middle' as const, label: '中间月 (Middle)', weight: weights.middle, color: 'accent-indigo-500' },
                  { id: 'early' as const, label: '最早月 (Early)', weight: weights.early, color: 'accent-slate-500' }
                ].map(w => (
                  <div key={w.id}>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-bold text-slate-300">{w.label}</span>
                      <span className="text-lg font-bold mono">{Math.round(w.weight * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={Math.round(w.weight * 100)}
                      onChange={(e) => handleWeightChangeBalanced(w.id, parseInt(e.target.value))}
                      className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-700 ${w.color}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-500">
                <Info className="w-3 h-3" /> 权重配置决定了日均销量受各月份波动的影响程度
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-full flex flex-col">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <BarChart className="w-4 h-4 text-blue-500" /> 已匹配销售记录 ({salesList.length})
                </span>
              </div>
              <div className="flex-grow overflow-auto">
                {salesList.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 text-left">SKU & 月份</th>
                        <th className="px-4 py-4 text-right">往期 3 月份销量</th>
                        <th className="px-6 py-4 text-right">加权日均 (Base)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {salesList.slice(0, 50).map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{item.sellerSku}</div>
                            <div className="text-[9px] text-slate-400 mt-1 uppercase font-bold">
                              {item.monthNames.join(' / ')}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-3 font-mono text-xs">
                              <span className="text-blue-600 font-bold" title="最近月">{Math.round(item.months.recent)}</span>
                              <span className="text-slate-300">|</span>
                              <span className="text-indigo-600 font-bold" title="中间月">{Math.round(item.months.middle)}</span>
                              <span className="text-slate-300">|</span>
                              <span className="text-slate-500 font-bold" title="最早月">{Math.round(item.months.early)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-base font-black text-slate-900 mono">{item.weightedAvg.toFixed(2)}</div>
                            <div className="text-[10px] font-bold text-blue-500 uppercase">PCS / Day</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-300 italic">
                    <Calendar className="w-12 h-12 mb-2 opacity-10" />
                    请导入包含日期列（如 2024-01）的销售报表
                  </div>
                )}
              </div>
              {salesList.length > 50 && (
                <div className="px-6 py-3 bg-slate-50 text-center text-[10px] text-slate-400 font-bold border-t border-slate-100 uppercase tracking-widest">
                  仅显示前 50 条记录
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesTab;
