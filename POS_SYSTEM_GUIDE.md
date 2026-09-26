# POS System Implementation Guide

## 1. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                     POS Frontend (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Add Items   │  │  Cart View   │  │   Checkout   │      │
│  │  (Parts/     │  │  (Line Items)│  │  (Payment)   │      │
│  │   Services)  │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬─────────────────────────────────────┘
                         │ (IPC Calls)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Main Process (Node.js)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Payment Gateway Handler                             │  │
│  │  - Cash: Immediate approval                          │  │
│  │  - Card: External API (Stripe/Square) integration   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Transaction Manager                                 │  │
│  │  - Store transaction in DB                           │  │
│  │  - Generate receipt                                  │  │
│  │  - Update inventory                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   SQLite Database                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  sales       │  │  inventory   │  │  customers   │      │
│  │  (new table) │  │  (updated)   │  │  (new table) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. DATABASE SCHEMA (New Tables)

### `sales` Table
Stores every transaction
```sql
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT UNIQUE,           -- Unique receipt number
  customer_id INTEGER,                   -- Link to customers table
  customer_name TEXT,
  customer_phone TEXT,
  sale_date TEXT,                        -- ISO format timestamp
  subtotal REAL,
  tax REAL,
  discount REAL,
  total REAL,
  payment_method TEXT,                   -- 'cash' | 'card' | 'check'
  payment_status TEXT,                   -- 'pending' | 'approved' | 'declined'
  payment_reference TEXT,                -- Card transaction ID or reference
  notes TEXT,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
```

### `sale_items` Table
Stores each item in a transaction
```sql
CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER,
  item_type TEXT,                        -- 'part' | 'service'
  item_id INTEGER,                       -- inventory_id OR service_history_id
  item_name TEXT,
  item_description TEXT,
  quantity REAL,
  unit_price REAL,
  total_price REAL,                      -- quantity * unit_price
  FOREIGN KEY(sale_id) REFERENCES sales(id)
);
```

### `customers` Table (New)
Stores customer information
```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  created_date TEXT
);
```

### `inventory_transactions` Table (New)
Audit trail for inventory changes
```sql
CREATE TABLE inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER,
  transaction_type TEXT,                 -- 'sale' | 'adjustment' | 'return'
  quantity_change INTEGER,
  reference_id TEXT,                     -- sale_id that triggered this
  date TEXT,
  FOREIGN KEY(inventory_id) REFERENCES inventory(id)
);
```

---

## 3. PAYMENT METHODS & FLOW

### Option A: CASH PAYMENT
```
User selects "Cash" payment
       ↓
User enters amount paid
       ↓
System calculates change
       ↓
Status: IMMEDIATELY APPROVED ✓
       ↓
Generate receipt & save to DB
       ↓
Print/Display receipt
```

**In Code:**
```javascript
// In main.js - IPC Handler
ipcMain.handle('pos:processCashPayment', async (event, saleData) => {
  const { total, amountPaid } = saleData;
  const change = amountPaid - total;
  
  if (change < 0) {
    return { success: false, error: 'Insufficient payment' };
  }
  
  // Immediately approved
  return {
    success: true,
    paymentStatus: 'approved',
    change: change,
    receiptNumber: generateReceiptNumber()
  };
});
```

### Option B: CARD PAYMENT (Stripe/Square Integration)
```
User selects "Card" payment
       ↓
User enters card info OR swipes card
       ↓
System sends to Stripe/Square API
       ↓
     ├─ APPROVED ✓
     │     ↓
     │  Status: APPROVED
     │     ↓
     │  Generate receipt
     │
     └─ DECLINED ✗
           ↓
        Status: DECLINED
           ↓
        Show error, ask to retry
```

**In Code:**
```javascript
// In main.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

ipcMain.handle('pos:processCardPayment', async (event, paymentData) => {
  const { token, amount, customer } = paymentData;
  
  try {
    const charge = await stripe.charges.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      source: token,
      description: `Sale for ${customer.name}`,
      metadata: { customerId: customer.id }
    });
    
    if (charge.status === 'succeeded') {
      return {
        success: true,
        paymentStatus: 'approved',
        transactionId: charge.id,
        receiptNumber: generateReceiptNumber()
      };
    }
  } catch (error) {
    return {
      success: false,
      paymentStatus: 'declined',
      error: error.message
    };
  }
});
```

### Option C: CHECK PAYMENT
```
User selects "Check" payment
       ↓
User enters check number & bank info
       ↓
Status: PENDING (manual verification later)
       ↓
System flags for verification
       ↓
Admin can approve/decline in backend
```

---

## 4. PAYMENT PROCESSING FLOW (Complete)

```javascript
// Frontend: POS.jsx or Checkout.jsx

const handleCheckout = async (saleData) => {
  // 1. Validate cart
  if (saleData.items.length === 0) {
    alert('Cart is empty');
    return;
  }
  
  // 2. Ask payment method
  const paymentMethod = await showPaymentModal();
  // Returns: 'cash' | 'card' | 'check'
  
  // 3. Process payment based on method
  let paymentResult;
  
  if (paymentMethod === 'cash') {
    const amountPaid = await promptUserForAmount(saleData.total);
    paymentResult = await window.api.processCashPayment({
      total: saleData.total,
      amountPaid: amountPaid
    });
  }
  
  if (paymentMethod === 'card') {
    const cardToken = await captureCardInfo(); // Using Stripe elements
    paymentResult = await window.api.processCardPayment({
      token: cardToken,
      amount: saleData.total,
      customer: saleData.customer
    });
  }
  
  if (paymentMethod === 'check') {
    const checkInfo = await promptForCheckInfo();
    paymentResult = await window.api.processCheckPayment({
      amount: saleData.total,
      checkInfo: checkInfo,
      customer: saleData.customer
    });
  }
  
  // 4. Handle result
  if (paymentResult.success) {
    // Save complete transaction
    const saleId = await window.api.saveSale({
      ...saleData,
      paymentStatus: paymentResult.paymentStatus,
      paymentReference: paymentResult.transactionId,
      receiptNumber: paymentResult.receiptNumber
    });
    
    // 5. Update inventory
    await window.api.updateInventoryFromSale(saleData.items);
    
    // 6. Generate & print receipt
    const receipt = await window.api.generateReceipt(saleId);
    printReceipt(receipt);
    
    // 7. Clear cart & reset
    clearCart();
    showSuccessMessage('Sale completed!');
  } else {
    showErrorMessage(`Payment declined: ${paymentResult.error}`);
  }
};
```

---

## 5. RECEIPT GENERATION

### Receipt Template
```
╔════════════════════════════════════╗
║   GREEN LINE AUTO SERVICE          ║
║   Receipt                          ║
╠════════════════════════════════════╣
║ Receipt #: 20260906-001234         ║
║ Date: Sep 6, 2026 2:34 PM          ║
║ Customer: John Doe                 ║
║ Phone: (555) 123-4567              ║
╠════════════════════════════════════╣
║ Items:                             ║
║                                    ║
║ Oil Change (Service)    1x $89.99  ║
║                              $89.99║
║ Brake Pads (Part)       2x $15.50  ║
║                              $31.00║
║ Air Filter (Part)       1x $12.99  ║
║                              $12.99║
╠════════════════════════════════════╣
║ Subtotal:                    $133.98║
║ Tax (8%):                      $10.72║
║ Discount:                      -$0.00║
╠════════════════════════════════════╣
║ TOTAL:                       $144.70║
╠════════════════════════════════════╣
║ Payment Method: CARD               ║
║ Transaction ID: ch_123456789...    ║
║ Status: ✓ APPROVED                 ║
╠════════════════════════════════════╣
║ Thank you for your business!       ║
║ www.greenlineauto.com              ║
╚════════════════════════════════════╝
```

### Receipt Generation (Node.js)
```javascript
function generateReceipt(saleData) {
  const {
    receiptNumber,
    saleDate,
    customer,
    items,
    subtotal,
    tax,
    discount,
    total,
    paymentMethod,
    paymentReference,
    paymentStatus
  } = saleData;
  
  let receipt = `
╔════════════════════════════════════╗
║   GREEN LINE AUTO SERVICE          ║
║   Receipt                          ║
╠════════════════════════════════════╣
║ Receipt #: ${receiptNumber.padEnd(29)}║
║ Date: ${new Date(saleDate).toLocaleString().padEnd(26)}║
║ Customer: ${customer.name.padEnd(25)}║
║ Phone: ${customer.phone.padEnd(28)}║
╠════════════════════════════════════╣
║ Items:                             ║
│ 
  `;
  
  items.forEach(item => {
    const line = `${item.name.substring(0, 20)} ${item.quantity}x $${item.unit_price.toFixed(2)}`.padEnd(33);
    const price = `$${item.total_price.toFixed(2)}`.padStart(7);
    receipt += `║ ${line}${price}║\n`;
  });
  
  receipt += `║                                    ║
╠════════════════════════════════════╣
║ Subtotal:${('$' + subtotal.toFixed(2)).padStart(24)}║
║ Tax (${getTaxRate()}%):${('$' + tax.toFixed(2)).padStart(25)}║
║ Discount:${('$' + discount.toFixed(2)).padStart(24)}║
╠════════════════════════════════════╣
║ TOTAL:${('$' + total.toFixed(2)).padStart(28)}║
╠════════════════════════════════════╣
║ Payment: ${paymentMethod.toUpperCase().padEnd(24)}║
║ Reference: ${paymentReference.padEnd(21)}║
║ Status: ${(paymentStatus === 'approved' ? '✓ APPROVED' : '✗ DECLINED').padEnd(23)}║
╚════════════════════════════════════╝
  `;
  
  return receipt;
}
```

---

## 6. INVENTORY AUTO-UPDATE

When a sale is completed:

```javascript
async function updateInventoryFromSale(saleItems) {
  for (const item of saleItems) {
    if (item.type === 'part') {
      // Reduce inventory quantity
      db.run(
        'UPDATE inventory SET quantity = quantity - ? WHERE id = ?',
        [item.quantity, item.itemId]
      );
      
      // Log transaction
      db.run(
        'INSERT INTO inventory_transactions (inventory_id, transaction_type, quantity_change, reference_id, date) VALUES (?, ?, ?, ?, ?)',
        [item.itemId, 'sale', -item.quantity, saleId, new Date().toISOString()]
      );
    }
    // Services don't have inventory impact (already tracked in service_history)
  }
  saveDatabase();
}
```

---

## 7. UI COMPONENTS NEEDED

### 1. **POS.jsx** (Main POS Page)
- Left sidebar: Browse parts & services
- Center: Shopping cart
- Right: Customer info & checkout

### 2. **POSCart.jsx** (Cart Component)
- List of items in cart
- Edit quantities
- Remove items
- Subtotal/total display

### 3. **POSCheckout.jsx** (Payment Component)
- Payment method selector (Cash/Card/Check)
- Customer info form
- Payment processor integration
- Receipt display

### 4. **POSReports.jsx** (Reports Dashboard)
- Daily sales total
- Top selling items
- Payment method breakdown
- Customer sales history
- Export to CSV

---

## 8. IPC HANDLERS NEEDED (main.js)

```javascript
// Payment Processing
ipcMain.handle('pos:processCashPayment', ...)
ipcMain.handle('pos:processCardPayment', ...)
ipcMain.handle('pos:processCheckPayment', ...)

// Sales Management
ipcMain.handle('pos:saveSale', ...)
ipcMain.handle('pos:getSaleHistory', ...)
ipcMain.handle('pos:generateReceipt', ...)

// Inventory
ipcMain.handle('pos:updateInventoryFromSale', ...)
ipcMain.handle('pos:getAvailableParts', ...)

// Customers
ipcMain.handle('pos:searchCustomer', ...)
ipcMain.handle('pos:createCustomer', ...)
ipcMain.handle('pos:updateCustomer', ...)

// Reports
ipcMain.handle('pos:getDailySalesReport', ...)
ipcMain.handle('pos:getMonthlySalesReport', ...)
```

---

## 9. SETUP CHECKLIST

- [ ] Add 4 new database tables (sales, sale_items, customers, inventory_transactions)
- [ ] Create db.js functions for all CRUD operations
- [ ] Add IPC handlers in main.js for payments & sales
- [ ] Create POS components (POS.jsx, POSCart.jsx, POSCheckout.jsx, POSReports.jsx)
- [ ] Setup payment gateway API (Stripe/Square - optional, can start with cash)
- [ ] Add receipt generation function
- [ ] Add POS tab to Sidebar
- [ ] Test complete checkout flow
- [ ] Add sales reports dashboard

---

## 10. IMPLEMENTATION APPROACH

**Phase 1 (Minimal):** Cash payments only
- Simple cart system
- Cash payment processing
- Basic receipt generation
- Inventory auto-update
- Simple sales log

**Phase 2:** Card payments
- Stripe integration
- Card payment processing
- Better receipt formatting
- Transaction ID tracking

**Phase 3:** Advanced
- Customer database
- Loyalty/rewards
- Sales reports
- Inventory alerts
- Tax configuration

---

Would you like me to proceed with **Phase 1 (Cash POS System)** first?

