# Missouri State Lacrosse – Official Website
![JavaScript](https://img.shields.io/badge/JavaScript-ES2023-f7df1e.svg)
![React](https://img.shields.io/badge/React-19.2.0-61dafb.svg)
![React Router](https://img.shields.io/badge/React_Router-7.9.5-ca4245.svg)
![Vite](https://img.shields.io/badge/Vite-7.1.12-646cff.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1.16-38bdf8.svg)

![Firebase](https://img.shields.io/badge/Firebase-12.5.0-ffca28.svg)
![PayPal SDK](https://img.shields.io/badge/PayPal_JS-8.9.2-0070ba.svg)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-12.23.24-ff0050.svg)

This repository contains the official website for Missouri State Lacrosse, built with a full role-based user experience and complete backend integrations for team operations, e-commerce, and account management.

# Overview
The platform provides a unified digital presence for both the Men’s and Women’s lacrosse programs, supporting roster management, event scheduling, media galleries, online team store functionality, and administrative tools. It is designed for reliability, scalability, and secure access control.

# Features
## Role-Based User Experience
- Separate experiences for players, coaches, admins, and public visitors
- Program-scoped permissions for Men’s and Women’s teams
- Dynamic content rendering based on authenticated user role
- Secure Firestore-backed user data model

## PayPal Integration
- Server-side PayPal REST API integration via a Spring Boot backend
- Secure order creation and capture flow
- Support for team store purchases, donations, and fundraising tools
- Sandbox and production environments managed via environment variables

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
- React
- JavaScript
- Firebase Firestore
- Firebase Auth
- Firebase Storage

## Backend
- Java 17 / Spring Boot
- PayPal Java SDK
- Printify REST integration
- AWS SES
- AWS Secrets Manager
- Hosted on AWS EC2

## Infrastructure & Tools
- Firestore Security Rules
- Firebase Hosting (Frontend)
- Amazon SES Verified Domain

## Project Goals
- Provide a fast, reliable, and modern website for Missouri State Lacrosse
- Centralize player information, rosters, and media
- Power an integrated team store with automated fulfillment
- Offer a secure, role-based admin system for managing team operations

## License
This project is proprietary software for Missouri State Lacrosse and is not open-source unless explicitly stated.
