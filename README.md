# Missouri State Lacrosse – Official Website
![JavaScript](https://img.shields.io/badge/javascript-ES2023-f7df1e?logo=javascript)
![React](https://img.shields.io/badge/react-19.2.0-61dafb?logo=react)
![React Router](https://img.shields.io/badge/react_router-7.9.5-ca4245?logo=reactrouter)
![Vite](https://img.shields.io/badge/vite-7.1.12-646cff?logo=vite)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-4.1.16-38bdf8?logo=tailwindcss)

![Firebase](https://img.shields.io/badge/firebase-12.5.0-ffca28?logo=firebase)
![PayPal JS](https://img.shields.io/badge/paypal_js-8.9.2-0070ba?logo=paypal)
![Framer Motion](https://img.shields.io/badge/framer_motion-12.23.24-e91e63?logo=framer)


This repository contains the official website for Missouri State Lacrosse, built with a full role-based user experience and complete backend integrations for team operations, e-commerce, and account management.

# Overview
The platform provides a unified digital presence for both the Men’s and Women’s lacrosse programs, supporting roster management, event scheduling, media galleries, online team store functionality, and administrative tools. It is designed for reliability, scalability, and secure access control.

# Features
## Role-Based User Experience
- Separate experiences for players, coaches, admins, and public visitors
- Program-scoped permissions for Men’s and Women’s teams
- Dynamic content rendering based on authenticated user role
- Secure Firestore-backed user data model

## Payments (PayPal + Stripe)
- Server-side PayPal REST integration and a parallel Stripe Embedded Checkout rail
- Both rails write the same `payment_receipts` shape, so dues / raffle / event / store
  logic is processor-agnostic
- Active rail chosen per program at build time via `VITE_PAYMENT_PROVIDER` /
  `VITE_PAYMENT_PROVIDER_WOMEN` (`paypal` default, `stripe` optional)
- Stripe is webhook-driven with an idempotent confirm fast-path
- Full details: [`docs/payments.md`](docs/payments.md)

## Printify Integration
- Full REST API integration for product listings and order creation
- Automatic variant detection and mapping
- Real-time product sync for the official team store
- Price adjustments and fulfillment routing via Printify’s backend

## Firebase Authentication
- Email/password authentication for all users
- Account-request workflow with admin approval
- Automatic user document creation in Firestore
- Program and role assignment stored in a structured Firestore schema

## Email Service (Amazon SES)
- No-reply transactional email service using no-reply@missouristatelacrosse.com
- Used for:
  - Account request confirmation
  - Approval/denial notifications
  - Order confirmations
- Fully compliant DKIM, SPF, and DMARC configuration

# Tech Stack
## Frontend
- React 19 + TypeScript + Vite
- Firebase Auth (email/password + account-request approval)
- Tailwind CSS

## Backend
- Java 17 / Spring Boot 3.5
- PostgreSQL + Flyway (schema-per-program: `men` / `women`)
- PayPal REST (hand-rolled `RestTemplate`) + Stripe Java SDK
- Printify REST integration
- AWS: SES (email), S3 (image storage), Secrets Manager (prod config)
- Self-hosted RTMP/HLS streaming via MediaMTX on EC2
- Hosted on AWS EC2 (`api.missouristatelacrosse.com`)
- See [`backend/README.md`](backend/README.md)

## Infrastructure & Tools
- Firebase Hosting (frontend)
- Amazon SES verified domain (DKIM / SPF / DMARC)
- AWS EC2 + S3

## Project Goals
- Provide a fast, reliable, and modern website for Missouri State Lacrosse
- Centralize player information, rosters, and media
- Power an integrated team store with automated fulfillment
- Offer a secure, role-based admin system for managing team operations

## License
This project is proprietary software for Missouri State Lacrosse and is not open-source unless explicitly stated.
