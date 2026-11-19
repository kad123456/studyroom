# 🎓 StudyRoom — Real-Time Collaborative Virtual Study Room

A full-stack, real-time virtual study room web application inspired by **StudyStream**. Built with Next.js (App Router), Tailwind CSS, Lucide Icons, PeerJS (WebRTC mesh), and Firebase Realtime Database for state synchronization.

---

## ✨ Features

- 📹 **Multi-User Video Grid (StudyStream Style)**
  - Live webcam feeds connecting peer-to-peer over WebRTC mesh (PeerJS) — no paid video APIs required.
  - Displays each participant's name, active study goal status badge, and mute/camera indicators.
  - Pin any video tile for focus view, or responsive multi-tile layout.
- 🎛️ **Bottom Control Bar**
  - Toggle Camera On/Off.
  - Toggle Microphone (defaults to muted on join for quiet focus sessions).
  - Screen Sharing with automatic fallback to webcam.
  - Instant "Copy Invite Link" with room ID.
  - Clean Leave Room button.
- ⏱️ **Shared Synced Pomodoro Timer**
  - Prominent circular SVG countdown timer synced across everyone in the room.
  - 25m Focus / 5m Short Break / 15m Long Rest presets.
  - Subtle audio chimes synthesized directly via the Web Audio API on phase switches.
  - Anyone can Start, Pause, Reset, or Skip phases.
- 💬 **Live Room Chat**
  - Synced text chat for sharing links, questions, and encouragement.
  - Quick emoji reaction stickers.
- ✅ **Task & Goal Tracker**
  - Add session goals (e.g. "Finish Chapter 4 Notes").
  - Check off completed tasks with progress percentage.
  - "Set as active goal" button instantly displays the badge below your video tile.
- 🎵 **Ambient Soundscapes & Lofi Player**
  - Built-in soundscapes: Rainy Atmosphere, Cozy Coffee Shop, Lo-fi Study Beats, and Pure White Noise (synthesized via Web Audio API).
  - Individual volume sliders and mute controls.
- 🎨 **Customizable Aesthetic Backgrounds**
  - Cozy Night, Rainy Window, Minimalist Dark, Lo-fi Library, and Forest Sanctuary themes.

---

## 🚀 5-Minute Setup & Deployment Guide

### Step 1: Set Up Free Firebase Realtime Database (2 minutes)

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **"Add project"**.
2. Name your project (e.g. `studyroom`) and click **Continue**. (Google Analytics is optional).
3. In the left navigation bar, go to **Build → Realtime Database** and click **"Create Database"**.
4. Choose any region close to you and select **"Start in test mode"** (allows instant read/write for testing).
5. Go to **Project Settings** (gear icon ⚙️ on top left) → scroll to **"Your apps"** → click the **Web icon (`</>`)**.
6. Register the app (e.g., name it `StudyRoom Web`) and copy the config values.

### Step 2: Configure Environment Variables

In your project directory, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the values from your Firebase Web App configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:...
```

> **Note:** The app is designed to run in standalone local preview mode even without Firebase keys, but adding Firebase enables real-time synchronization between separate browsers and devices!

### Step 3: Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploy to Vercel (1-Click or CLI)

### Option A: Via Vercel Dashboard (Easiest)

1. Push this repository to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of StudyRoom"
   git branch -M main
   git remote add origin https://github.com/yourusername/study-room.git
   git push -u origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
3. Under **Environment Variables**, add the 7 variables from your `.env.local` file:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
4. Click **Deploy**. Vercel will build and assign you an automatic HTTPS URL (e.g., `https://study-room.vercel.app`).

### Option B: Via Vercel CLI

```bash
npm install -g vercel
vercel
# Follow prompts to link project
vercel --prod
```

> **Why HTTPS is required:** Browsers strictly require HTTPS (or `localhost`) for `navigator.mediaDevices.getUserMedia` camera and microphone access. Deploying to Vercel provides HTTPS out of the box so your friends can join via webcam immediately!

---

## 🔒 Recommended Firebase Realtime Database Security Rules

Once ready for production, go to **Firebase Console → Realtime Database → Rules** and paste:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

---

## 🏗️ Architecture

```
User A (Browser) <======== PeerJS WebRTC Mesh ========> User B (Browser)
       \                                                      /
        \---> Firebase Realtime Database (Signaling & Sync) <-/
              - Participant presence & status
              - Pomodoro timer synchronization
              - Shared task tracker
              - Room text chat
```
