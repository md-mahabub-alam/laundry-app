# 🧺 FreshFold Laundry — Online Pickup & Delivery Platform

A complete, zero-dependency Node.js web application for an online laundry & dry-cleaning service featuring dedicated portals for **Customers**, **Riders**, and **Admins**.

## 🚀 Quick Start

No external npm packages are required — the project runs directly on Node.js (>= 16).

```bash
cd ~/laundry-app
npm start
```

Then open **http://localhost:3000** in your browser.

To reset the database back to fresh demo data at any time:
```bash
npm run reset
```

---

## 🔑 Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@freshfold.com` | `admin123` |
| **Customer** | `customer@demo.com` | `123456` |
| **Rider** | `rider@demo.com` | `123456` |

*(You can also one-click fill these credentials directly on the `/login` page, or sign up new customer and rider accounts.)*

---

## ✨ Features by Role

### 👤 Customer Portal (`#/c/dashboard`)
- **Schedule Pickup**: Browse laundry categories (`Wash & Iron`, `Wash & Fold`, `Dry Cleaning`, `Iron Only`, `Shoe Care`), add items by piece or kg, select Express priority cleaning, apply coupon codes (`WELCOME20`, `FLAT50`), choose pickup & delivery addresses, pick a date and time slot, and pay via **Cash on Delivery** or **Online Payment** (Card / bKash / Nagad demo gateway).
- **Live Order Tracking**: 7-stage visual progress bar (`Placed` → `Rider Assigned` → `Picked Up` → `Cleaning` → `Ready` → `On the Way` → `Delivered`), full status timeline, rider contact details, printable invoices, one-click reorder, order cancellation (before pickup), and 5-star service + rider ratings.
- **Address Book & Profile**: Save multiple addresses (with default address selection and Google Maps links), edit personal info, and change password.

### 🛵 Rider Portal (`#/r/dashboard`)
- **Online / Offline Toggle**: Control availability for receiving tasks.
- **Pickup & Delivery Workflow**:
  - **Pickup tasks**: View customer phone, address, Google Maps navigation link, time slot, and notes → mark **Picked Up** → mark **Dropped at Laundry**.
  - **Delivery tasks**: Navigate to delivery address, confirm **Cash on Delivery (COD)** collection when applicable → mark **Delivered**.
- **Earnings & Cash Tracking**: Track today's and total earnings, completed tasks, customer ratings, and unsettled COD cash in hand to deposit to the office.
- **Rider Profile**: Manage vehicle type, registration number, NID, and preferred service area.

### 🛡️ Admin Panel (`#/a/dashboard`)
- **Analytics Dashboard**: Total & today's orders, collected vs. pending revenue, 7-day revenue bar chart, online rider counts, and actionable alerts (new orders needing pickup, ready orders needing delivery, pending rider applications, unsettled COD cash).
- **Order Operations**: Filter and search orders by status, customer, phone, or area; assign pickup & delivery riders (automatically sorted by online status, matching area, and active workload); advance laundry processing stages (`Received at Laundry` → `Processing` → `Ready for Delivery`); override statuses or payment states.
- **Rider Management**: Approve or revoke new rider applications, monitor active tasks and earnings, settle collected COD cash with one click, reset passwords, or block/unblock accounts.
- **Customer Management**: Inspect customer profiles, addresses, order history, total spend, and block/unblock accounts.
- **Services, Coupons & Settings**: Full CRUD for laundry services & pricing, promotional coupons, business info, delivery fees, free-delivery thresholds, express surcharge, rider commission per task, pickup time slots, and service areas.

