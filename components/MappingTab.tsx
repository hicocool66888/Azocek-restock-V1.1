
import React from 'react';
import * as XLSX from 'xlsx';
import { Upload, Database, FileText, ChevronRight } from 'lucide-react';

interface Props {
  mapping: Record<string, string>;
  onUpdate: (mapping: Record<string, string>) => void;
}

const MappingTab: React.FC<Props> = ({ mapping, onUpdate }) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      const newMapping: Record<string, string> = {};
      let count = 0;
      
      rows.slice(1).forEach(row => {
        const sellerSku = row[0]?.toString().trim();
        const restockSku = row[1]?.toString().trim();
        if (sellerSku && restockSku) {
          newMapping[sellerSku] = restockSku;
          count++;
        }
      });

      onUpdate(newMapping);
      alert(`✅ 成功导入 ${count} 条映射关系`);
    };
    reader.readAsArrayBuffer(file);
  };

  const mappingList = Object.entries(mapping);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">🔗 SKU 映射管理</h2>
            <p className="text-slate-500 mt-1">上传映射表以建立卖家 SKU 与系统备货 SKU 的对应关系。</p>
          </div>
          <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold border border-blue-100">
            已建立 {mappingList.length} 组
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="group relative flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-all">
              <div className="p-4 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm font-bold text-slate-700">点击上传映射表</p>
                <p className="text-xs text-slate-400 mt-1">支持 Excel (.xlsx) 或 CSV 格式</p>
              </div>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
            </label>
            
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <h4 className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <FileText className="w-4 h-4" /> 文件格式要求
              </h4>
              <ul className="mt-2 text-xs text-amber-700 space-y-1 list-disc list-inside">
                <li>第一列：卖家 SKU (Seller SKU)</li>
                <li>第二列：备货 SKU (Stock SKU)</li>
                <li>必须包含表头行</li>
              </ul>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-sm">
              映射预览 (仅显示前 100 条)
            </div>
            <div className="h-[300px] overflow-y-auto">
              {mappingList.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 shadow-sm">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">卖家 SKU</th>
                      <th className="px-4 py-2 text-center w-10 text-slate-400"><ChevronRight className="w-4 h-4" /></th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">备货 SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappingList.slice(0, 100).map(([seller, restock], i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{seller}</td>
                        <td className="px-4 py-3 text-center text-slate-300">→</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">{restock}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 italic text-sm">
                  <Database className="w-12 h-12 mb-2 opacity-20" />
                  暂无映射数据
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MappingTab;
