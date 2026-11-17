# Building the Android app

The web game is wrapped with Capacitor (`android/` folder). The output is an `.apk`
file you can send to anyone; they open it on their phone and allow
"Install unknown apps" once.

The automatic APK build on GitHub was removed; the game is shared as a web page
instead (GitHub Pages, deployed from `main` by `.github/workflows/pages.yml`).
To build an APK locally:

## Android Studio
    npm install
    npm run build
    npx cap sync android
    npx cap open android      # then Build > Build APK(s)

APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

## After changing the game
Run `npm run build && npx cap sync android` before rebuilding the APK.
