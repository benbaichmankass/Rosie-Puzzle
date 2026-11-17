# Building the Android app

The web game is wrapped with Capacitor (`android/` folder). The output is an `.apk`
file you can send to anyone; they open it on their phone and allow
"Install unknown apps" once.

## Option A: GitHub builds it (no installs on your Mac)
Push this repo. The **Build Android APK** workflow runs on every push
(or run it by hand from the Actions tab). Download `bedtime-puzzle-apk` from the run.

## Option B: Android Studio
    npm install
    npm run build
    npx cap sync android
    npx cap open android      # then Build > Build APK(s)

APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

## After changing the game
Run `npm run build && npx cap sync android` before rebuilding the APK.
