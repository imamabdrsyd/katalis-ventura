'use client';

interface CashFlowHeaderProps {
  totalBalance: number;
  percentageChange: number;
  filterType: 'monthly' | 'yearly';
  selectedYear: number;
  selectedMonth?: number;
  onFilterChange: (type: 'monthly' | 'yearly') => void;
  onYearChange: (year: number) => void;
  onMonthChange?: (month: number) => void;
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function CashFlowHeader({
  totalBalance,
  percentageChange,
  filterType,
  selectedYear,
  selectedMonth,
  onFilterChange,
  onYearChange,
  onMonthChange,
}: CashFlowHeaderProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="mb-8">
      {/* Title & Stats */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Cashflow</h1>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold text-gray-900">
            ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span
            className={`text-lg font-semibold flex items-center gap-1 ${
              percentageChange >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {percentageChange >= 0 ? '📈' : '📉'} {percentageChange >= 0 ? '+' : ''}
            {percentageChange.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Filter Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onFilterChange('monthly')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${
              filterType === 'monthly'
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => onFilterChange('yearly')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${
              filterType === 'yearly'
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Yearly
          </button>
        </div>

        {/* Dropdowns */}
        <div className="flex gap-3 items-center">
          {filterType === 'monthly' && onMonthChange && (
            <select
              value={selectedMonth || new Date().getMonth()}
              onChange={(e) => onMonthChange(parseInt(e.target.value))}
              className="input bg-white"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="input bg-white"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
