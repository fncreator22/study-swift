# Examly Enterprise: Scalable Assessment & Learning Management System

![Examly Enterprise](https://img.shields.io/badge/Platform-Enterprise_SaaS-blueviolet?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-React_19_|_TanStack_|_Supabase-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-Commercial-green?style=for-the-badge)

## Executive Overview
**Examly Enterprise** is a high-performance, commercially-ready Learning Management System (LMS) and Assessment Platform designed for modern educational institutions, corporate training centers, and e-learning providers. 

The platform bridges the gap between content delivery and performance evaluation, providing a seamless end-to-end workflow from course consumption to rigorous exam execution. Built with a focus on scalability and sub-second performance, Examly enables organizations to deliver high-stakes testing at scale while maintaining deep analytical insights into student progress.

### 🌐 Live Deployment
The platform is live and deployed on Vercel at:
👉 **[https://examy-hazel.vercel.app](https://examy-hazel.vercel.app)**

### Business Value
*   **Operational Efficiency**: Automate the entire examination lifecycle from question banking to grading.
*   **Monetization Ready**: Integrated tiered access system (Free/Paid/Premium) for course and test content.
*   **Data-Driven Insights**: Real-time performance tracking and competitive rankings to drive student engagement.
*   **Enterprise Security**: Robust Role-Based Access Control (RBAC) ensuring data isolation and administrative integrity.

---

## Core Features

### Assessment Engine
*   **Dynamic Test Execution**: Support for timed examinations with automated session management.
*   **Multi-Type Question Support**: Handles Multiple Choice (MCQ) and written descriptive answers, and also has hybrid questions.
*   **Automated Grading**: Instant score calculation for objective questions and structured tracking for subjective content.
*   **Tiered Content Access**: Granular control over test availability based on user subscription (Free, Paid, Premium).

### Content Delivery System
*   **Integrated LMS Course Hub**: Feature-rich course modules supporting structured learning materials, curriculum trees, and interactive video lecture delivery.
*   **Progress Tracking**: Detailed progress visualizers to monitor course, module, and lesson-level completion.

### Token Wallet & Request System
*   **Virtual Coin Economy**: Self-contained token wallet system enabling students to accumulate credit and acquire test attempts.
*   **Token Pricing Rate**: The conversion rate is set to **`1 Token = 10 Rupees` (₹10)**.
    *   *Example*: A mock exam priced by the administrator at ₹100 will cost exactly 10 tokens to unlock in the student wallet.
*   **Request Pipeline**: Student-facing interface to request additional tokens directly from platform administrators.
*   **Administrative Ledger**: Dedicated management suite for administrative adjustments (credit/debit adjustments) and transaction logging.
*   **Global Rankings**: View-based leaderboard system calculating averages, attempt counts, and college-level performance.
*   **Historical Traceability**: Detailed attempt history for students to review past performance and progress.
*   **KPI Dashboards**: High-level statistical overviews for both students (learning progress) and admins (platform health).

### Administrative Operations
*   **User Management**: Complete control over student profiles, including account blocking and profile auditing.
*   **Content Orchestration**: Centralized management of tests, questions, and course materials.
*   **Moderation System**: Integrated comment and feedback management for community interaction.

---

## Enterprise Architecture

The platform utilizes a modern **Server-Side Rendering (SSR)** architecture, ensuring maximum SEO efficiency and instant page loads.

*   **Architecture Style**: Monolithic Frontend with Decoupled Backend-as-a-Service (BaaS).
*   **Frontend Framework**: **React 19** with **TanStack Start**, utilizing cutting-edge file-based routing and SSR capabilities.
*   **Service Layer**: **Supabase Integration**, providing real-time data synchronization and secure PostgreSQL interaction.
*   **State Management**: Hybrid approach using **React Query** for server state and **TanStack Router** for navigation state.
*   **Deployment Architecture**: Optimized for **Vercel Serverless Functions** via TanStack Start Build Output API, co-locating compiled assets and handler routes.

---

## Project Structure

```text
src/
├── components/          # Enterprise UI System
│   ├── ui/              # Atomized Radix-based components (Shadcn)
│   └── ...              # Feature-specific layouts
├── hooks/               # Custom business logic & platform hooks
├── integrations/        # External service connectors
│   └── supabase/        # Database client, Types, and Auth Middleware
├── lib/                 # Core utilities (Auth logic, error handling)
├── routes/              # TanStack File-based Routing
│   ├── _admin/          # Secure Administrative Portal
│   ├── _student/        # Student Learning Environment
│   └── __root.tsx       # Application Shell
└── types/               # Global TypeScript definitions
```

---

## Technology Stack

| Technology | Enterprise Benefit |
| :--- | :--- |
| **React 19** | Concurrent rendering and latest React features for ultra-responsive UI. |
| **TanStack Start** | Full-stack React framework providing type-safe routing and SSR. |
| **Supabase** | Scalable PostgreSQL database with built-in Auth and Real-time capabilities. |
| **Tailwind CSS 4** | High-performance, utility-first styling with advanced design tokens. |
| **Lucide React** | Consistent, professional iconography across the platform. |
| **Zod** | Schema-first validation for robust data integrity. |

---

## Authentication & RBAC

Examly implements a strict **Zero-Trust** authentication model:

1.  **Identity Management**: Powered by Supabase Auth with session persistence.
2.  **Role Hierarchy**:
    *   `student`: Access to learning dashboard, test attempts, and history.
    *   `admin`: Full access to platform management, user auditing, and content creation.
3.  **Route Protection**: Middleware-level redirection ensuring unauthorized users cannot access restricted portals.
4.  **Database Security**: Row-Level Security (RLS) on PostgreSQL to ensure users only see their own data and authorized content.

---

## Assessment & Monetization Logic

### Purchase Workflow
The platform supports a "Pay-per-Test" model. The `purchases` system links users to specific test IDs, which is then verified via the `has_test_access` database function before allowing an attempt.

---

## Database & Storage Architecture

The persistence layer is built on **PostgreSQL** via Supabase, utilizing advanced relational features:

*   **Rankings View**: A materialized logic layer (`rankings_view`) that aggregates millions of attempt rows into performant leaderboards.
*   **Auditability**: `created_at` and `submitted_at` timestamps on all critical tables ensure a full audit trail.
*   **Referential Integrity**: Strict foreign key constraints between Tests, Questions, and Attempts to prevent data corruption.

---

## Scalability & Performance

*   **Current Scalability**: Capable of handling thousands of concurrent test-takers due to Cloudflare's edge deployment.
*   **Optimizations**: 
    *   **SSR**: Pre-rendering of static content for instant first-paint.
    *   **PostgreSQL Views**: Complex calculations are offloaded to the database layer.
    *   **Tree-shaking**: Minimal bundle size through Vite-optimized builds.
    *   **Premium Visual Experience**: Integrated modern design patterns with glowing ambient light backdrops, interactive scaling transitions, and rich OKLCH-based gradients to maximize visual excellence and user engagement.

---

## Known Limitations & Technical Debt

*   **Offline Support**: Currently requires an active connection for test submission; Service Worker-based persistence is a recommended upgrade.
*   **Media Storage**: Heavy reliance on external URLs for videos; integration with Supabase Storage for direct uploads is recommended.

---

## License
Copyright © 2026. All Rights Reserved. This software is licensed under a Commercial Enterprise License. Unauthorized copying or distribution of these files is strictly prohibited.

---

## Contribution Guidelines
1.  **Branching**: All features must be developed on `feature/` branches.
2.  **Linting**: Adherence to Prettier and ESLint configurations is mandatory.
3.  **Type Safety**: No `any` types allowed; all database interactions must use generated Supabase types.

---

## ⚙️ Deployment Environment Variables

To run the application, configure the following variables in Vercel's settings (**Settings -> Environment Variables**):

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `SUPABASE_URL` | `https://your-project.supabase.co` | Server API connection |
| `SUPABASE_PUBLISHABLE_KEY` | `your-supabase-publishable-key` | Client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-supabase-service-role-key` | Server-side admin queries |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Client API queries |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `your-supabase-publishable-key` | Client authentication |

## 🚀 How to Deploy on Vercel

The project is built on the TanStack Start framework using the Build Output API, co-locating Serverless Functions. Deploy it using the following commands:

```bash
# 1. Pull current settings from Vercel
npx vercel pull --yes --environment production --token <YOUR_TOKEN>

# 2. Build production assets locally (outputs to .vercel/output)
npx vercel build --prod --token <YOUR_TOKEN>

# 3. Deploy prebuilt assets directly to production
npx vercel deploy --prebuilt --prod --token <YOUR_TOKEN>
```


