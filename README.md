# 🚀 Katalis Ventura

**Multi-Role Private Equity Management Platform** for Business Managers and Investors.

Built with Next.js 14, TypeScript, Supabase, and Tailwind CSS.

---

## 📋 Overview

Katalis Ventura is a SaaS finance management system designed specifically for private equity firms, property management companies, and investment groups. The platform supports two distinct user roles:

- **👔 Business Managers** - Full operational control: CRUD transactions, manage team, generate reports
- **📊 Investors** - Portfolio monitoring: View reports, create custom metrics, track performance

### Key Features

✅ Multi-tenant architecture (multiple businesses per user)  
✅ Role-based access control (RLS policies)  
✅ Real-time financial dashboards  
✅ Transaction management with 6 categories (EARN, OPEX, VAR, CAPEX, TAX, FIN)  
✅ Automated financial statements (Income, Balance Sheet, Cash Flow)  
✅ Custom investor metrics builder  
✅ Team management & invite system  
✅ PDF export functionality  
✅ Responsive design (mobile, tablet, desktop)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Git

### 1. Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd katalis-ventura

# Install dependencies
npm install
```

### 2. Setup Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in Supabase dashboard
3. Copy entire content from `supabase/schema.sql`
4. Run the SQL to create tables, indexes, and RLS policies

### 3. Configure Environment Variables

```bash
# Copy example env file
cp .env.local.example .env.local

# Edit .env.local with your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Where to find these values:**
- Go to Supabase Dashboard → Settings → API
- Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📐 Project Structure

```
katalis-ventura/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (grouped route)
│   │   ├── login/
│   │   ├── signup/
│   │   └── layout.tsx
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── reports/
│   │   └── layout.tsx
│   ├── setup-business/           # Onboarding for managers
│   ├── join-business/            # Onboarding for investors
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css
├── components/                   # React components
│   ├── ui/                       # Reusable UI components
│   ├── dashboard/                # Dashboard-specific components
│   ├── charts/                   # Chart components
│   └── forms/                    # Form components
├── lib/                          # Utilities & helpers
│   ├── supabase.ts               # Supabase client
│   ├── utils.ts                  # General utilities
│   └── calculations.ts           # Financial calculations
├── types/                        # TypeScript definitions
│   └── index.ts
├── supabase/                     # Supabase config
│   └── schema.sql                # Database schema
├── public/                       # Static assets
├── .env.local.example            # Environment template
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

---

## 🗄️ Database Schema

### Core Tables

**1. `businesses`** - Business entities
- Each business represents a fund, property, or investment vehicle
- Stores capital investment, property details, etc.

**2. `user_business_roles`** - Many-to-many junction table
- Links users to businesses with specific roles
- Enables multi-tenancy (1 user → multiple businesses)

**3. `transactions`** - Financial transactions
- 6 categories: EARN, OPEX, VAR, CAPEX, TAX, FIN
- Linked to businesses for data isolation

**4. `investor_metrics`** - Custom KPI definitions
- Investors create personalized metrics (ROI, margins, ratios)
- JSONB formula storage for flexibility

**5. `profiles`** - Extended user information
- Stores full name, avatar, default role preference

**6. `invite_codes`** - Team invitation system
- Generate codes for inviting users to businesses
- Track usage and expiration

### Security Model

All tables use **Row Level Security (RLS)** policies:

- **Business Managers**: Full CRUD on their businesses
- **Investors**: Read-only access to businesses they're assigned to
- Data isolation: Users only see data from businesses they have access to

---

## 🎯 User Flows

### Business Manager Journey

```
Sign Up (as Manager)
    ↓
Setup Business Form
    ↓
Dashboard (Full Access)
    ↓
Add Transactions
    ↓
View Reports
    ↓
Invite Team Members
```

### Investor Journey

```
Sign Up (as Investor)
    ↓
Join Business (via invite code)
    ↓
Dashboard (Read-Only)
    ↓
View Reports
    ↓
Create Custom Metrics
    ↓
Monitor Performance
```

---

## 🔐 Authentication

Uses **Supabase Auth** with:
- Email/Password authentication
- Session management
- Role-based middleware (coming soon)

### Protecting Routes

Example middleware for protected routes:

```typescript
// middleware.ts (to be created)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession();
  return res;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

---

## 📊 Financial Calculations

### Transaction Categories

| Category | Description | Example |
|----------|-------------|---------|
| **EARN** | Revenue/Income | Rental income, booking fees |
| **OPEX** | Operating Expenses | Utilities, maintenance, management fees |
| **VAR** | Variable Costs | Cleaning, supplies, commissions |
| **CAPEX** | Capital Expenditure | Furniture, renovations, equipment |
| **TAX** | Taxes | Income tax, property tax |
| **FIN** | Financing | Loan payments, withdrawals |

### Key Metrics

**Net Profit** = EARN - OPEX - VAR - CAPEX - TAX

**Gross Profit** = EARN - VAR

**ROI** = (Net Profit / Capital) × 100%

**Cash Flow** = Operating + Investing + Financing

All calculations are in `lib/calculations.ts` with TypeScript safety.

---

## 🎨 UI Components

### Design System

- **Colors**: Indigo primary, gradient accents
- **Typography**: Inter font family
- **Spacing**: Tailwind default scale
- **Components**: Custom utility classes in `globals.css`

### Reusable Classes

```css
.card          /* White rounded card with shadow */
.btn-primary   /* Indigo button */
.btn-secondary /* Gray button */
.input         /* Form input with focus ring */
.badge-earn    /* Green badge for earnings */
.badge-opex    /* Red badge for expenses */
```

---

## 🧪 Testing (Coming Soon)

```bash
# Unit tests
npm run test

# E2E tests with Playwright
npm run test:e2e
```

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

**Environment Variables in Vercel:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add `NEXT_PUBLIC_SUPABASE_URL`
3. Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Other Platforms

Works on any platform that supports Next.js:
- Netlify
- Railway
- Render
- AWS Amplify

---

## 📝 Roadmap

### Phase 1: MVP ✅
- [x] Authentication system
- [x] Business & user management
- [x] Transaction CRUD
- [x] Basic reports

### Phase 2: Investor Features (Current)
- [ ] Custom metrics builder
- [ ] Investor dashboard
- [ ] Performance alerts
- [ ] Metric comparisons

### Phase 3: Advanced
- [ ] Multi-currency support
- [ ] Recurring transactions
- [ ] Budget forecasting
- [ ] Mobile app (React Native)

### Phase 4: Scale
- [ ] Webhooks & API access
- [ ] Third-party integrations (Xero, QuickBooks)
- [ ] White-label options
- [ ] AI-powered insights

---

## 🤝 Contributing

Contributions welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow ESLint rules
- Add JSDoc comments for complex functions
- Write descriptive commit messages

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 💬 Support

Need help? Have questions?

- 📧 Email: support@katalisventura.com
- 💬 Discord: [Join our community](#)
- 📚 Docs: [docs.katalisventura.com](#)

---

## 🙏 Acknowledgments

Built with amazing open-source tools:
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend & Auth
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Chart.js](https://www.chartjs.org/) - Data visualization
- [Lucide Icons](https://lucide.dev/) - Icon set

---

**Made with ❤️ for Private Equity & Property Management**
