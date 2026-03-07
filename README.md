# IELTS & PTE Training Management Platform

A modern web platform designed to help IELTS and PTE training academies manage students, courses, assignments, and exam readiness in one place.

This system replaces the common workflow of WhatsApp groups, spreadsheets, and manual coordination with a structured digital platform.

## Features

### Student Portal

* Student registration and login
* Course selection (IELTS or PTE)
* View lessons and modules
* View assignments and submit work
* Track training progress
* Receive announcements and live session updates

### Teacher Dashboard

* Manage courses and modules
* Create and manage lessons
* Create assignments for students
* Schedule live sessions (Zoom / Google Meet)
* Send announcements
* Track student activity

### Admin Controls

* Approve student registrations and payments
* Manage users (students and teachers)
* Monitor platform activity
* Manage course structure

### Smart Training Workflow

The platform follows a real academy workflow:

1. Student registers and selects a course
2. Admin approves payment
3. Student gains access to training
4. Teachers upload lessons and assignments
5. Students complete training
6. Teachers monitor progress and exam readiness

### UI Features

* Dark mode and light mode
* Accent color customization
* Modern responsive interface

## Technology Stack

Frontend

* React
* Vite
* TailwindCSS

Backend

* Firebase Authentication
* Firebase Firestore
* Firebase Storage

Deployment

* Vercel

## Installation (Local Development)

Clone the repository:

```bash
git clone https://github.com/yourusername/project-name.git
cd project-name
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the application:

```
https://studies-awards-ielts-platform.vercel.app/dashboard
```

## Deployment

The project is deployed using **Vercel**.

To deploy updates:

```bash
npm run build
vercel --prod
```

## Project Structure

```
src
 ├ components
 ├ pages
 ├ services
 ├ hooks
 ├ contexts
 └ utils
```

## Future Improvements

* Automatic exam eligibility tracking
* Teacher exam booking panel
* Attendance tracking
* Student progress analytics
* AI-based IELTS speaking practice

## Purpose

This project was built to demonstrate how modern web technology can improve the workflow of IELTS and PTE training academies by replacing manual coordination systems.

## Author

Emmanuel Kiprono

