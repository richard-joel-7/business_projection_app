import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Filter, BarChart3 } from 'lucide-react';
import { parseDate, getFY, getCY } from '../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function ProjectExpandedPanel({
  project,
  dateContext,
  displayCurrency,
  formatExactAmount,
  formatDisplayAmount,
  timelineFilter,
  selectedYears,
  selectedMonths,
  yearType,
  isDateWithinTimeline
}) {
  const [selectedBin, setSelectedBin] = useState('All');
  const [localYearFilter, setLocalYearFilter] = useState('All');
  const [chartTimeline, setChartTimeline] = useState('month'); // 'month' or 'week'

  // Extract unique years from project billables
  const availableYears = useMemo(() => {
    if (!project.billables) return [];
    const years = new Set();
    project.billables.forEach(b => {
      const dateStr = String(b['Billable_date'] || "").trim();
      const date = parseDate(dateStr);
      if (date) {
        const yearVal = yearType === "CY" ? getCY(date) : getFY(date);
        years.add(yearVal);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [project.billables, yearType]);

  // Apply global filters to billables
  const globallyFilteredBillables = useMemo(() => {
    if (!project.billables) return [];
    
    if (dateContext !== 'billableDate') return project.billables;

    return project.billables.filter(b => {
      const dateStr = String(b['Billable_date'] || "").trim();
      const date = parseDate(dateStr);
      if (!date) return false;

      if (timelineFilter !== 'all' && !isDateWithinTimeline(date, timelineFilter)) return false;

      if (selectedYears && selectedYears.length > 0) {
        const yearVal = yearType === "CY" ? getCY(date) : getFY(date);
        if (!selectedYears.includes(yearVal)) return false;
      }

      if (selectedMonths && selectedMonths.length > 0) {
        const monthShort = date.toLocaleString('default', { month: 'short' });
        if (!selectedMonths.includes(monthShort)) return false;
      }

      return true;
    });
  }, [project.billables, dateContext, timelineFilter, selectedYears, selectedMonths, yearType, isDateWithinTimeline]);

  // Extract unique bins
  const bins = useMemo(() => {
    if (!globallyFilteredBillables) return ['All'];
    const binSet = new Set();
    globallyFilteredBillables.forEach(b => {
      const binNum = b['Bin_number'] || 'N/A';
      binSet.add(String(binNum));
    });
    return ['All', ...Array.from(binSet).sort()];
  }, [globallyFilteredBillables]);

  // Filter billables by bin and local year
  const filteredBillables = useMemo(() => {
    if (!globallyFilteredBillables) return [];
    let filtered = globallyFilteredBillables;

    if (selectedBin !== 'All') {
      filtered = filtered.filter(b => String(b['Bin_number'] || 'N/A') === selectedBin);
    }

    if (localYearFilter !== 'All') {
      filtered = filtered.filter(b => {
        const dateStr = String(b['Billable_date'] || "").trim();
        const date = parseDate(dateStr);
        if (!date) return false;
        const yearVal = yearType === "CY" ? getCY(date) : getFY(date);
        return yearVal === localYearFilter;
      });
    }

    return filtered;
  }, [globallyFilteredBillables, selectedBin, localYearFilter, yearType]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const groupedData = {};

    const monthNamesCY = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthNamesFY = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const baseMonths = yearType === 'FY' ? monthNamesFY : monthNamesCY;

    if (chartTimeline === 'month') {
      baseMonths.forEach((m, idx) => {
        groupedData[m] = { name: m, amount: 0, order: idx };
      });
    } else if (chartTimeline === 'week') {
      baseMonths.forEach((m, mIdx) => {
        for (let w = 1; w <= 5; w++) {
          const key = `${m} W${w}`;
          groupedData[key] = { name: key, amount: 0, order: mIdx * 10 + w };
        }
      });
    }

    if (filteredBillables && filteredBillables.length > 0) {
      filteredBillables.forEach(b => {
        const dateStr = String(b['Billable_date'] || "").trim();
        const date = parseDate(dateStr);
        if (!date) return;

        const month = date.toLocaleString('default', { month: 'short' });
        let key = '';
        
        if (chartTimeline === 'month') {
          key = month;
        } else if (chartTimeline === 'week') {
          const weekOfMonth = Math.ceil(date.getDate() / 7);
          key = `${month} W${weekOfMonth}`;
        }

        const rawAmount = displayCurrency === 'INR' 
          ? (b['Amount_in_Inr'] || 0) 
          : (b['Amount_in_USD'] || 0);
          
        const amountStr = String(rawAmount).replace(/[^0-9.-]+/g, "");
        const amount = parseFloat(amountStr) || 0;

        if (groupedData[key]) {
          groupedData[key].amount += amount;
        }
      });
    }

    return Object.values(groupedData).sort((a, b) => a.order - b.order);
  }, [filteredBillables, chartTimeline, displayCurrency, yearType]);

  const formatChartTooltip = (value) => {
    return dateContext === 'billableDate' 
      ? formatExactAmount(value) 
      : formatDisplayAmount(value);
  };

  if (!project.billables || project.billables.length === 0) {
    return (
      <div className="p-6 pl-14">
        <div className="text-sm text-gray-500 italic bg-dark-700/30 p-4 rounded-lg border border-white/5 inline-block">
          No billables recorded for this project yet.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pl-14 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          Billable Details
        </h4>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-dark-800/50 border border-white/10 rounded-lg p-1">
            <Filter size={14} className="text-gray-400 ml-2" />
            <select
              value={localYearFilter}
              onChange={(e) => setLocalYearFilter(e.target.value)}
              className="bg-transparent border-none text-xs text-gray-300 focus:ring-0 cursor-pointer"
            >
              <option value="All">All {yearType}s</option>
              {availableYears.map(year => (
                <option key={year} value={year} className="bg-dark-800 text-gray-300">
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-dark-800/50 border border-white/10 rounded-lg p-1">
            <Filter size={14} className="text-gray-400 ml-2" />
            <select
              value={selectedBin}
              onChange={(e) => setSelectedBin(e.target.value)}
              className="bg-transparent border-none text-xs text-gray-300 focus:ring-0 cursor-pointer"
            >
              {bins.map(bin => (
                <option key={bin} value={bin} className="bg-dark-800 text-gray-300">
                  {bin === 'All' ? 'All Bins' : `Bin ${bin}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-dark-800/50 border border-white/10 rounded-lg p-0.5">
            <BarChart3 size={14} className="text-gray-400 ml-2 mr-1" />
            <button
              onClick={() => setChartTimeline('month')}
              className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${
                chartTimeline === 'month' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setChartTimeline('week')}
              className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${
                chartTimeline === 'week' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-dark-800/30 rounded-xl border border-white/5 p-4 h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#ffffff50" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#ffffff50" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
                    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
                    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                    return value;
                  }}
                />
                <Tooltip 
                  cursor={{ fill: '#ffffff05' }}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#ffffff10', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value) => [formatChartTooltip(value), 'Amount']}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#34d399" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
              No valid data for chart
            </div>
          )}
        </div>

        <div className="xl:col-span-1">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Entries ({filteredBillables.length})
          </div>
          <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {filteredBillables.map((b, bIdx) => (
              <div key={bIdx} className="bg-dark-700/50 p-3 rounded-lg border border-white/5 flex flex-col gap-1 relative overflow-hidden group/card hover:border-primary/30 transition-colors shrink-0">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/50"></div>
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500 font-medium">Bin: {b['Bin_number'] || 'N/A'}</span>
                  <div className="flex items-center gap-1">
                    {b['Status'] && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                        {b['Status']}
                      </span>
                    )}
                    <span className="text-[10px] font-bold tracking-wider text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                      {b['Billable_id'] || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="text-sm font-semibold text-white mt-1">
                  {dateContext === 'billableDate' 
                    ? formatExactAmount(parseFloat(String(displayCurrency === 'INR' ? (b['Amount_in_Inr'] || 0) : (b['Amount_in_USD'] || 0)).replace(/[^0-9.-]+/g, "")) || 0) 
                    : formatDisplayAmount(b['Amount_in_USD'])}
                </div>
                <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar size={10} /> {b['Billable_date'] || 'No Date'}
                    </div>
                    {b['Type'] && (
                      <span className="text-[10px] text-gray-500">{b['Type']}</span>
                    )}
                  </div>
                  {b['Remarks'] && (
                    <div className="text-[10px] text-gray-400 mt-2 p-1.5 bg-dark-800/50 rounded border border-white/5 line-clamp-2" title={b['Remarks']}>
                      <span className="font-semibold text-gray-500">Remarks:</span> {b['Remarks']}
                    </div>
                  )}
                </div>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
}
