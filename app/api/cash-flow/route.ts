import { NextRequest, NextResponse } from 'next/server';

interface CashFlowDataPoint {
  month: string;
  income: number;
  expense: number;
}

// Mock data - Replace with actual database queries
const mockCashFlowData: { [key: string]: CashFlowDataPoint[] } = {
  monthly_2026: [
    { month: 'Jan', income: 35000, expense: 28000 },
    { month: 'Feb', income: 45000, expense: 22000 },
    { month: 'Mar', income: 38000, expense: 32000 },
    { month: 'Apr', income: 42000, expense: 28000 },
    { month: 'May', income: 40000, expense: 35000 },
    { month: 'Jun', income: 48000, expense: 38000 },
    { month: 'Jul', income: 50000, expense: 40000 },
    { month: 'Aug', income: 46000, expense: 35000 },
    { month: 'Sep', income: 44000, expense: 32000 },
    { month: 'Oct', income: 38000, expense: 28000 },
    { month: 'Nov', income: 40000, expense: 30000 },
    { month: 'Dec', income: 52000, expense: 42000 },
  ],
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const businessId = searchParams.get('businessId');
  const filterType = searchParams.get('filterType') || 'monthly';
  const year = searchParams.get('year') || new Date().getFullYear();
  const month = searchParams.get('month');

  if (!businessId) {
    return NextResponse.json(
      { error: 'Business ID is required' },
      { status: 400 }
    );
  }

  try {
    // For now, return mock data
    // In production, query your database with: businessId, filterType, year, month
    const key =
      filterType === 'monthly'
        ? `monthly_${year}`
        : `yearly_${year}`;

    const data = mockCashFlowData[key] || mockCashFlowData.monthly_2026;

    // Calculate total balance and percentage change
    const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
    const totalExpense = data.reduce((sum, d) => sum + d.expense, 0);
    const totalBalance = totalIncome - totalExpense;

    // Mock percentage change
    const percentageChange = 12.3;

    return NextResponse.json({
      data,
      totalBalance,
      percentageChange,
    });
  } catch (error) {
    console.error('Error fetching cash flow data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cash flow data' },
      { status: 500 }
    );
  }
}
