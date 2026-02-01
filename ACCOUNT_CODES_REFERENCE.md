# Account Codes Quick Reference

## 📊 Chart of Accounts - Property Rental Business

### 💰 ASSETS (1000-1999)

#### Current Assets (1100-1199)
| Code | Account Name | Description |
|------|--------------|-------------|
| 1100 | Current Assets | Aset lancar |
| 1110 | Cash | Kas tunai |
| **1120** | **Bank - BCA** | Rekening Bank BCA ⭐ Most Used |
| 1121 | Bank - Mandiri | Rekening Bank Mandiri |
| 1122 | Bank - BNI | Rekening Bank BNI |
| 1130 | E-Wallet - OVO | E-wallet OVO |
| 1131 | E-Wallet - GoPay | E-wallet GoPay |
| 1132 | E-Wallet - Dana | E-wallet Dana |

#### Fixed Assets (1200-1299)
| Code | Account Name | Description |
|------|--------------|-------------|
| 1200 | Fixed Assets | Aset tetap |
| 1210 | Property - Building | Properti sewa |
| 1220 | Furniture & Fixtures | Furniture dan perlengkapan |
| 1230 | Equipment | Peralatan |
| 1240 | Accumulated Depreciation | Akumulasi penyusutan |

---

### 💳 LIABILITIES (2000-2999)

#### Current Liabilities (2100-2199)
| Code | Account Name | Description |
|------|--------------|-------------|
| 2100 | Current Liabilities | Liabilitas jangka pendek |
| 2110 | Accounts Payable | Hutang usaha |
| 2120 | Utilities Payable | Hutang utilitas |

#### Long-term Liabilities (2200-2299)
| Code | Account Name | Description |
|------|--------------|-------------|
| 2200 | Long-term Liabilities | Liabilitas jangka panjang |
| 2210 | Loan Payable | Pinjaman bank |

---

### 👥 EQUITY (3000-3999)

| Code | Account Name | Description |
|------|--------------|-------------|
| 3100 | Capital | Modal pemilik |
| 3200 | Retained Earnings | Laba ditahan |
| 3300 | Owner Drawings | Penarikan pemilik |

---

### 💵 REVENUE (4000-4999)

| Code | Account Name | Description |
|------|--------------|-------------|
| **4100** | **Rental Income** | Pendapatan sewa ⭐ Most Used |
| 4200 | Service Fees | Biaya layanan |
| 4300 | Other Income | Pendapatan lain-lain |

---

### 💸 EXPENSES (5000-5999)

#### Operating Expenses - OPEX (5100-5199)
| Code | Account Name | Description |
|------|--------------|-------------|
| **5110** | **Utilities - Electricity** | Listrik ⭐ Common |
| 5111 | Utilities - Water | Air |
| 5112 | Utilities - Gas | Gas |
| 5113 | Internet & Phone | Internet dan telepon |
| 5120 | Property Maintenance | Pemeliharaan properti |
| 5130 | Insurance | Asuransi |
| 5140 | Management Fees | Biaya manajemen |
| 5150 | Marketing & Advertising | Pemasaran dan iklan |

#### Variable Costs - VAR (5200-5299)
| Code | Account Name | Description |
|------|--------------|-------------|
| **5210** | **Cleaning Services** | Biaya kebersihan ⭐ Common |
| 5220 | Guest Amenities | Amenitas tamu |
| 5230 | Laundry | Laundry |
| 5240 | Platform Commission | Komisi platform |

#### Taxes - TAX (5300-5399)
| Code | Account Name | Description |
|------|--------------|-------------|
| 5310 | Income Tax | Pajak penghasilan |
| 5320 | Property Tax | Pajak bumi bangunan (PBB) |
| 5330 | VAT | PPN |

#### Financing - FIN (5400-5499)
| Code | Account Name | Description |
|------|--------------|-------------|
| 5410 | Interest Expense | Bunga pinjaman |

---

## 🎯 Common Transaction Patterns

### Pattern 1: Receive Rental Income via Bank
```
Debit:  1120 (Bank BCA)         → Money IN to bank
Credit: 4100 (Rental Income)    → Revenue increases
```

### Pattern 2: Pay Electricity Bill from Bank
```
Debit:  5110 (Utilities - Electricity)  → Expense increases
Credit: 1120 (Bank BCA)                 → Money OUT from bank
```

### Pattern 3: Pay Cleaning Service with Cash
```
Debit:  5210 (Cleaning Services)  → Expense increases
Credit: 1110 (Cash)               → Cash decreases
```

### Pattern 4: Buy Furniture with Bank Transfer
```
Debit:  1220 (Furniture & Fixtures)  → Asset increases
Credit: 1120 (Bank BCA)              → Money OUT from bank
```

### Pattern 5: Owner Withdrawal
```
Debit:  3300 (Owner Drawings)  → Equity decreases
Credit: 1120 (Bank BCA)        → Money OUT from bank
```

### Pattern 6: Pay Property Tax
```
Debit:  5320 (Property Tax)  → Tax expense
Credit: 1120 (Bank BCA)      → Money OUT from bank
```

---

## 💡 Quick Tips

### Remember: DEBIT vs CREDIT
- **DEBIT** = Where money goes / What increases on left side
  - Increases: Assets, Expenses
  - Decreases: Liabilities, Equity, Revenue

- **CREDIT** = Where money comes from / What increases on right side
  - Increases: Liabilities, Equity, Revenue
  - Decreases: Assets, Expenses

### Normal Balance
- **Debit normal balance**: Assets (1xxx), Expenses (5xxx)
- **Credit normal balance**: Liabilities (2xxx), Equity (3xxx), Revenue (4xxx)

### Category to Account Mapping (Auto-Suggested)

| Category | Typical Debit | Typical Credit | Example |
|----------|---------------|----------------|---------|
| EARN | 1120 (Bank) | 4100 (Rental Income) | Customer pays rent |
| OPEX | 5110 (Utilities) | 1120 (Bank) | Pay electricity |
| VAR | 5210 (Cleaning) | 1120 (Bank) | Pay cleaning service |
| CAPEX | 1210 (Property) | 1120 (Bank) | Buy furniture |
| TAX | 5310 (Tax) | 1120 (Bank) | Pay income tax |
| FIN | 3300 (Drawings) | 1120 (Bank) | Owner withdrawal |

---

## 🔍 Excel Import Examples

### Double-Entry Format (Recommended)
```
Date       | Category | Name      | Description     | Amount  | Account | Debit | Credit
2025-02-01 | EARN     | Customer  | Monthly rent    | 5000000 | BCA     | 1120  | 4100
2025-02-05 | OPEX     | PLN       | Electricity     | 800000  | BCA     | 5110  | 1120
2025-02-10 | VAR      | Cleaning  | Monthly clean   | 500000  | Cash    | 5210  | 1110
```

### Legacy Format (Backward Compatible)
```
Date       | Category | Name      | Description     | Amount  | Account | Debit | Credit
2025-02-01 | EARN     | Customer  | Monthly rent    | 5000000 | BCA     |       |
2025-02-05 | OPEX     | PLN       | Electricity     | 800000  | Cash    |       |
```

---

**Pro Tip:** When in doubt, use the category suggestions! The system will automatically suggest the most common debit/credit accounts for each category. ✨
