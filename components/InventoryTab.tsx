
import React, { useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Warehouse, Plane, Ship, Package, CheckCircle2, Trash2 } from 'lucide-react';
import { InventoryTabProps, OverseasData, OfficialInventoryData } from '../types';

const InventoryTab: React.FC<InventoryTabProps> = ({ 
  mapping, 
  overseas, 
  officialInventory, 
  onUpdateOverseas, 
  onUpdateOfficial,
  onClearOverseas,
  onClearOfficial
}) => {
  const overseasInputRef = useRef<HTMLInputElement>(null);
  const officialInputRef = useRef<HTMLInputElement>(null);

  // 辅助函数：根据关键词查找列名
  const findColumn = (headers: string[], keywords: string[], defaultIdx: number) => {
    const found = headers.find(h => 
      keywords.some(k => h.toLowerCase().includes(k.toLowerCase()))
    );
    return found || headers[defaultIdx];
  };

  const handleOverseasUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        
        if (rows.length === 0) return;
        const headers = Object.keys(rows[0]);

        const skuCol = findColumn(headers, ['sku', '编码', '商品'], 0);
        const whCol = findColumn(headers, ['仓库', 'warehouse', '仓'], 1);
        const availCol = findColumn(headers, ['可用', 'available', '现货', '库存'], 2);
        const transitCol = findColumn(headers, ['在途', 'transit', '预入', 'inbound'], 3);

        const newOverseas: OverseasData = {};
        rows.forEach(row => {
          const sellerSku = row[skuCol]?.toString().trim();
          const prepSku = mapping[sellerSku];
          if (!prepSku) return;

          if (!newOverseas[prepSku]) {
            newOverseas[prepSku] = { 
              la: { available: 0, transit: 0 }, 
              ny: { available: 0, transit: 0 } 
            };
          }
          
          const whRaw = row[whCol]?.toString().trim().toUpperCase() || '';
          const available = parseFloat(row[availCol]) || 0;
          const transit = parseFloat(row[transitCol]) || 0;

          // 兼容多种仓库命名
          if (whRaw.includes('LA') || whRaw.includes('洛杉矶') || whRaw.includes('WEST')) {
            newOverseas[prepSku].la.available += available;
            newOverseas[prepSku].la.transit += transit;
          } else if (whRaw.includes('NY') || whRaw.includes('纽约') || whRaw.includes('EAST')) {
            newOverseas[prepSku].ny.available += available;
            newOverseas[prepSku].ny.transit += transit;
          } else {
            // 默认归入 LA
            newOverseas[prepSku].la.available += available;
            newOverseas[prepSku].la.transit += transit;
          }
        });

        onUpdateOverseas(newOverseas);
      } catch (err) {
        alert('❌ 导入海外仓失败');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [mapping, onUpdateOverseas]);

  const handleOfficialUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        
        if (rows.length === 0) return;
        const headers = Object.keys(rows[0]);

        // 增强关键词匹配
        const skuCol = findColumn(headers, ['sku', '卖家sku', 'seller-sku', '商品'], 0);
        const availCol = findColumn(headers, ['可用', 'available', '现货', '库存'], 1);
        const transitCol = findColumn(headers, ['在途', 'transit', '预入', 'inbound', '预排'], 2);

        const newOfficial: OfficialInventoryData = {};
        rows.forEach(row => {
          const sellerSku = row[skuCol]?.toString().trim();
          const prepSku = mapping[sellerSku];
          if (!prepSku) return;

          if (!newOfficial[prepSku]) {
            newOfficial[prepSku] = { available: 0, transit: 0 };
          }
          newOfficial[prepSku].available += parseFloat(row[availCol]) || 0;
          newOfficial[prepSku].transit += parseFloat(row[transitCol]) || 0;
        });

        onUpdateOfficial(newOfficial);
      } catch (err) {
        alert('❌ 导入官方仓失败');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [mapping, onUpdateOfficial]);

  const handleClearOverseas = () => {
    if (window.confirm('🚨 确定要清空海外仓的所有库存数据吗？')) {
      onClearOverseas();
      if (overseasInputRef.current) overseasInputRef.current.value = '';
    }
  };

  const handleClearOfficial = () => {
    if (window.confirm('🚨 确定要清空官方仓的所有库存数据吗？')) {
      onClearOfficial();
      if (officialInputRef.current) officialInputRef.current.value = '';
    }
  };

  const overseasEntries = Object.entries(overseas);
  const officialEntries = Object.entries(officialInventory);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Overseas Warehouse Table Section */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Ship className="text-blue-600" /> 海外仓库存明细 (LA / NY)
            </h2>
            <p className="text-slate-500 mt-1">洛杉矶(LA)与纽约(NY)分仓的实时库存与在途明细表。</p>
          </div>
          <div className="flex items-center gap-3">
            {overseasEntries.length > 0 && (
              <button 
                type="button"
                onClick={handleClearOverseas}
                className="flex items-center gap-2 px-4 py-2.5 text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:shadow-sm rounded-xl text-sm font-bold transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" /> 清空数据
              </button>
            )}
            <label className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold cursor-pointer transition-all shadow-lg active:scale-95">
              <Upload className="w-4 h-4" /> 导入数据
              <input 
                ref={overseasInputRef} 
                type="file" 
                className="hidden" 
                accept=".xlsx,.csv" 
                onChange={handleOverseasUpload} 
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          {overseasEntries.length > 0 ? (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                <tr className="text-slate-600 font-bold text-[10px] uppercase tracking-wider">
                  <th rowSpan={2} className="px-6 py-4 text-left border-r border-slate-200 bg-slate-100">备货 SKU</th>
                  <th colSpan={3} className="px-6 py-2 text-center border-r border-slate-200 text-blue-700 bg-blue-50/50">LA 洛杉矶仓库</th>
                  <th colSpan={3} className="px-6 py-2 text-center border-r border-slate-200 text-indigo-700 bg-indigo-50/50">NY 纽约仓库</th>
                  <th rowSpan={2} className="px-6 py-4 text-right bg-slate-200 text-slate-900 font-black">库存总计</th>
                </tr>
                <tr className="text-slate-500 font-medium text-[9px] uppercase tracking-tight">
                  <th className="px-4 py-2 text-right bg-blue-50/20">可用 (AV)</th>
                  <th className="px-4 py-2 text-right bg-blue-50/20">在途 (TR)</th>
                  <th className="px-4 py-2 text-right bg-blue-100/30 border-r border-slate-200 text-blue-600 font-bold">小计</th>
                  <th className="px-4 py-2 text-right bg-indigo-50/20">可用 (AV)</th>
                  <th className="px-4 py-2 text-right bg-indigo-50/20">在途 (TR)</th>
                  <th className="px-4 py-2 text-right bg-indigo-100/30 border-r border-slate-200 text-indigo-600 font-bold">小计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {overseasEntries.map(([sku, data]) => {
                  const laTotal = data.la.available + data.la.transit;
                  const nyTotal = data.ny.available + data.ny.transit;
                  const grandTotal = laTotal + nyTotal;
                  return (
                    <tr key={sku} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4 border-r border-slate-100">
                        <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded font-black text-[10px] uppercase mono group-hover:bg-blue-600 group-hover:text-white transition-colors">{sku}</span>
                      </td>
                      <td className="px-4 py-4 text-right mono font-bold text-slate-950 bg-white border-r border-slate-50">{data.la.available.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right mono font-medium text-slate-500 italic bg-white border-r border-slate-50">+{data.la.transit.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right mono font-black text-blue-700 bg-blue-50/10 border-r border-slate-200">{laTotal.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right mono font-bold text-slate-950 bg-white border-r border-slate-50">{data.ny.available.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right mono font-medium text-slate-500 italic bg-white border-r border-slate-50">+{data.ny.transit.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right mono font-black text-indigo-700 bg-indigo-50/10 border-r border-slate-200">{nyTotal.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right mono font-black text-lg text-slate-900 bg-slate-50/50">{grandTotal.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-slate-300 bg-white">
              <Warehouse className="w-16 h-16 mb-4 opacity-10 text-slate-400" />
              <p className="font-bold text-sm uppercase tracking-widest text-slate-400">尚未导入海外仓库存数据</p>
            </div>
          )}
        </div>
      </section>

      {/* Official Warehouse Table Section */}
      <section className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden text-white border border-slate-800">
        <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/30">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
              <Plane className="text-blue-400 w-7 h-7" /> 官方仓库存
            </h2>
            <p className="text-slate-400 mt-1">同步官方自营仓库的可用库存与在途预入库量汇总表。</p>
          </div>
          <div className="flex items-center gap-3">
            {officialEntries.length > 0 && (
              <button 
                type="button"
                onClick={handleClearOfficial}
                className="flex items-center gap-2 px-4 py-2.5 text-red-400 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-sm font-bold transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" /> 清空数据
              </button>
            )}
            <label className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-sm font-bold cursor-pointer transition-all shadow-lg active:scale-95">
              <Upload className="w-4 h-4" /> 导入数据
              <input 
                ref={officialInputRef} 
                type="file" 
                className="hidden" 
                accept=".xlsx,.csv" 
                onChange={handleOfficialUpload} 
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          {officialEntries.length > 0 ? (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-800 border-b border-slate-700 shadow-lg sticky top-0 z-10">
                <tr className="text-slate-400 font-black text-[10px] uppercase tracking-widest">
                  <th className="px-8 py-4 text-left">备货 SKU</th>
                  <th className="px-8 py-4 text-right">可用库存 (Available)</th>
                  <th className="px-8 py-4 text-right">在途数量 (In Transit)</th>
                  <th className="px-8 py-4 text-right bg-slate-950 text-blue-400">官方仓库存合计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {officialEntries.map(([sku, data]) => {
                  const total = data.available + data.transit;
                  return (
                    <tr key={sku} className="hover:bg-slate-800/80 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-slate-600 group-hover:text-green-400 transition-colors" />
                          <span className="font-bold text-blue-300 mono tracking-tight group-hover:text-white">{sku}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right mono font-bold text-slate-100 tracking-tight text-lg">{data.available.toLocaleString()}</td>
                      <td className="px-8 py-5 text-right mono font-medium text-amber-500 tracking-tight text-lg">+{data.transit.toLocaleString()}</td>
                      <td className="px-8 py-5 text-right mono font-black text-2xl text-blue-400 bg-slate-950/40">{total.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-slate-700 bg-slate-900/50">
              <Package className="w-16 h-16 mb-4 opacity-20 text-slate-500" />
              <p className="font-bold text-sm uppercase tracking-widest text-slate-500">尚未同步官方仓库存记录</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default InventoryTab;
