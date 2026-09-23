# Missouri State Lacrosse – Official Website
![JavaScript](https://img.shields.io/badge/javascript-ES2023-f7df1e?logo=javascript)
![React](https://img.shields.io/badge/react-19.2.0-61dafb?logo=react)
![React Router](https://img.shields.io/badge/react_router-7.9.5-ca4245?logo=reactrouter)
![Vite](https://img.shields.io/badge/vite-7.1.12-646cff?logo=vite)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-4.1.16-38bdf8?logo=tailwindcss)

![AWS Cognito](https://img.shields.io/badge/auth-cognito-orange?logo=amazonaws)
![Stripe](https://img.shields.io/badge/stripe-live-635bff?logo=stripe)
![Framer Motion](https://img.shields.io/badge/framer_motion-12.23.24-e91e63?logo=framer)


This repository contains the official website for Missouri State Lacrosse, built with a full role-based user experience and complete backend integrations for team operations, e-commerce, and account management.

# Overview
The platform provides a unified digital presence for both the Men's and Women's lacrosse programs, supporting roster management, event scheduling, media galleries, online team store functionality, and administrative tools. It is designed for reliability, scalability, and secure access control.

**Start here for anything operational:** [`docs/HANDOFF.md`](docs/HANDOFF.md) is the
up-to-date map of every account, credential, and procedure. This README is a project
overview, not a runbook.

# Features
## Role-Based User Experience
- Separate experiences for players, coaches, admins, and public visitors
- Program-scoped permissions for Men's and Women's teams
- Dynamic content rendering based on authenticated user role

## Sign-in (Amazon Cognito)
- Invite-only accounts, created by an admin action, never self-registered
- Accounts created under the old Firebase login migrate automatically on next sign-in
  (see [`docs/cognito-migration-plan.md`](docs/cognito-migration-plan.md))
- Roles and program access live in our own database, not in the auth provider

## Payments (PayPal + Stripe)
- Server-side PayPal REST integration and a parallel Stripe Embedded Checkout rail
- Both rails write the same `payment_receipts` shape, so dues / raffle / event / store
  logic is processor-agnostic
- Active rail chosen per program via the `VITE_PAYMENT_PROVIDER` /
  `VITE_PAYMENT_PROVIDER_WOMEN` build variables - Stripe is the current live rail
- Stripe is webhook-driven with an idempotent confirm fast-path
- Full details: [`docs/payments.md`](docs/payments.md)

## Printify Integration
- Full REST API integration for product listings and order creation
- Automatic variant detection and mapping
- Real-time product sync for the official team store

## Email Service (Amazon SES)
- Transactional email from `no-reply@missouristatelacrosse.com`: account approvals,
  invites, password reset codes, order/donation confirmations
- Verified sending domain (DKIM / SPF / DMARC)

## Password manager
- A self-hosted Vaultwarden (Bitwarden-compatible) instance for team officers, on its
  own isolated server with no SSH access

# Tech Stack
## Frontend
- React 19 + TypeScript + Vite
- Amazon Cognito for sign-in
- Tailwind CSS
- Code-split by page, served from a private S3 bucket behind CloudFront

## Backend
- Java 17 / Spring Boot 3.5
- PostgreSQL + Flyway (schema-per-program: `men` / `women`)
- PayPal REST (hand-rolled `RestTemplate`) + Stripe Java SDK
- Printify REST integration
- AWS: SES (email), S3 (image storage), Cognito (sign-in), Secrets Manager (config)
- Self-hosted RTMP/HLS streaming via MediaMTX on EC2
- Hosted on AWS EC2 (`api.missouristatelacrosse.com`)
- See [`backend/README.md`](backend/README.md)

## Infrastructure
- AWS EC2, S3, CloudFront, Cognito, Secrets Manager, SES - **all defined as code** in
  [`infra/terraform/`](infra/terraform/README.md)
- A full staging environment (its own database, sign-in pool, and image bucket) -
  [`docs/staging.md`](docs/staging.md)
- Deploys run through GitHub Actions with no stored AWS keys (OIDC) and automatic
  rollback if a backend deploy doesn't come up healthy

## Project Goals
- Provide a fast, reliable, and modern website for Missouri State Lacrosse
- Centralize player information, rosters, and media
- Power an integrated team store with automated fulfillment
- Offer a secure, role-based admin system for managing team operations
- Be operable by a non-technical successor after handoff - see
  [`docs/HANDOFF.md`](docs/HANDOFF.md)

## License
This project is proprietary software for Missouri State Lacrosse and is not open-source unless explicitly stated.
