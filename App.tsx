
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  TrendingUp, 
  Ship, 
  Warehouse, 
  Download, 
  Upload 
} from 'lucide-react';
import { AppState, SalesData } from './types';

// Components
import MappingTab from './components/MappingTab';
import SalesTab from './components/SalesTab';
import InventoryTab from './components/InventoryTab';
import PlanningTab from './components/PlanningTab';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('mapping');
  const [appState, setAppState] = useState<AppState>({
    mapping: {},
    sales: {},
    overseas: {},
    officialInventory: {},
    weights: { recent: 0.5, middle: 0.3, early: 0.2 }
  });

  const [stats, setStats] = useState({
    mappedSkus: 0,
    matchedSales: 0,
    overseasMatched: 0,
    officialMatched: 0
  });

  useEffect(() => {
    setStats({
      mappedSkus: Object.keys(appState.mapping).length,
      matchedSales: Object.keys(appState.sales).length,
      overseasMatched: Object.keys(appState.overseas).length,
      officialMatched: Object.keys(appState.officialInventory).length
    });
  }, [appState]);

  const updateWeights = (newWeights: { recent: number, middle: number, early: number }) => {
    setAppState(prev => {
      const updatedSales = { ...prev.sales };
      Object.keys(updatedSales).forEach(sku => {
        const d = updatedSales[sku];
        const w0 = newWeights.recent;
        const w1 = newWeights.middle;
        const w2 = newWeights.early;
        d.weightedAvg = (d.daily.recent * w0) + (d.daily.middle * w1) + (d.daily.early * w2);
      });
      return { ...prev, weights: newWeights, sales: updatedSales };
    });
  };

  // 创建清空库存数据的函数
  const clearOverseasData = useCallback(() => {
    setAppState(prev => ({ ...prev, overseas: {} }));
  }, []);

  const clearOfficialData = useCallback(() => {
    setAppState(prev => ({ ...prev, officialInventory: {} }));
  }, []);

  const handleBackup = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart_restock_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setAppState(data);
        alert('✅ 数据恢复成功！');
      } catch (err) {
        alert('❌ 恢复失败：' + (err instanceof Error ? err.message : '未知错误'));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Smart Restock <span className="text-blue-400">V4.8.1</span></h1>
              <p className="text-slate-400 text-xs font-medium">智能备货决策辅助系统 Pro</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleBackup}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-all border border-slate-700 shadow-sm"
            >
              <Download className="w-4 h-4 text-slate-200" /> <span className="text-slate-200">备份数据</span>
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium cursor-pointer transition-all shadow-lg">
              <Upload className="w-4 h-4 text-white" /> 恢复备份
              <input type="file" className="hidden" accept=".json" onChange={handleRestore} />
            </label>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-800/50 backdrop-blur-md border-t border-slate-700">
          <div className="max-w-7xl mx-auto px-6">
            <nav className="flex overflow-x-auto no-scrollbar">
              {[
                { id: 'mapping', label: '1. 映射表', icon: Database },
                { id: 'sales', label: '2. 销售数据', icon: TrendingUp },
                { id: 'inventory', label: '3. 库存情况', icon: Warehouse },
                { id: 'planning', label: '4. 备货计划', icon: Ship, highlight: true }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap
                    ${activeTab === tab.id 
                      ? 'border-blue-500 text-blue-400 bg-slate-700/50' 
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'}
                    ${tab.highlight && activeTab !== tab.id ? 'text-amber-400' : ''}
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8">
        {activeTab === 'mapping' && (
          <MappingTab 
            mapping={appState.mapping} 
            onUpdate={(mapping) => setAppState(p => ({ ...p, mapping }))} 
          />
        )}
        {activeTab === 'sales' && (
          <SalesTab 
            mapping={appState.mapping}
            sales={appState.sales}
            weights={appState.weights}
            onUpdate={(sales) => setAppState(p => ({ ...p, sales }))}
            onUpdateWeights={updateWeights}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab 
            mapping={appState.mapping}
            overseas={appState.overseas}
            officialInventory={appState.officialInventory}
            onUpdateOverseas={(overseas) => setAppState(p => ({ ...p, overseas }))}
            onUpdateOfficial={(officialInventory) => setAppState(p => ({ ...p, officialInventory }))}
            onClearOverseas={clearOverseasData}
            onClearOfficial={clearOfficialData}
          />
        )}
        {activeTab === 'planning' && (
          <PlanningTab appState={appState} />
        )}
      </main>

      {/* Footer / Status Bar */}
      <footer className="bg-white border-t border-slate-200 py-3 sticky bottom-0 z-40">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-between items-center text-[10px] md:text-xs font-medium text-slate-500">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${stats.mappedSkus ? 'bg-green-500' : 'bg-slate-300'}`}></span>
              映射: {stats.mappedSkus}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${stats.matchedSales ? 'bg-green-500' : 'bg-slate-300'}`}></span>
              销售匹配: {stats.matchedSales}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${stats.overseasMatched ? 'bg-green-500' : 'bg-slate-300'}`}></span>
              海外仓: {stats.overseasMatched}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${stats.officialMatched ? 'bg-green-500' : 'bg-slate-300'}`}></span>
              官方仓: {stats.officialMatched}
            </div>
          </div>
          <div className="text-slate-400">
            System Operational • Precision Mode Enabled
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
