# Pace for Android

This wraps the Pace prototype (`../pace`) as an Android app using [Capacitor](https://capacitorjs.com). The screens and money logic are the same code as the web prototype. Capacitor packages it into a native Android app that works offline.

- **App ID:** `com.bogatimahesh.pace`. Change it in `capacitor.config.json` and `android/app/build.gradle` **before the first upload to Play**. After that it can never change.
- **Minimum Android:** 7.0 (API 24). **Target:** API 36.
- **The store build differs from the web prototype in three ways:** it opens on first-time setup instead of sample data, it bundles the Inter font so it needs no internet, and the Android back button steps back through screens and sheets before leaving the app.

## Build it

GitHub builds it automatically. Every push that changes `pace/` or `mobile/` runs `.github/workflows/android.yml`. Open the run under **Actions** and download `pace-debug-apk` from **Artifacts**.

To build on your own computer, you need Node 22, JDK 21 and Android Studio (or the Android SDK):

```sh
cd mobile
npm ci
npm run sync                       # builds www/ from ../pace and copies it into android/
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

You can also run `npx cap open android` to open the project in Android Studio and press Run.

## Install on your phone today

1. Download the `pace-debug-apk` artifact from the Actions run, unzip it, and copy `app-debug.apk` to your phone.
2. On the phone, open the file. Android will ask you to allow **Install unknown apps** for your file manager or browser. Allow it, then tap **Install**.

A debug APK is fine for you and friends to try. It can't be uploaded to Google Play.

## Google Play

Google requires new personal developer accounts to run a **closed test with at least 12 testers for 14 days in a row** before the app can go to production ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)). Organisation accounts (registered with a D-U-N-S number) are exempt. Plan for about two to three weeks, not one day.

1. **Create a developer account** at [play.google.com/console](https://play.google.com/console). There's a one-off registration fee, and identity verification can take a few days.
2. **Create an upload key** on your own computer, once. Keep the file and the passwords safe and backed up, and never commit them:
   ```sh
   keytool -genkeypair -v -keystore pace-upload.jks -alias pace-upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 pace-upload.jks > pace-upload.jks.b64    # on macOS: base64 -i pace-upload.jks -o pace-upload.jks.b64
   ```
3. **Add four repository secrets** in GitHub (Settings → Secrets and variables → Actions):
   - `PACE_KEYSTORE_BASE64`: the contents of `pace-upload.jks.b64`
   - `PACE_KEYSTORE_PASSWORD`
   - `PACE_KEY_ALIAS`: `pace-upload`
   - `PACE_KEY_PASSWORD`

   The next workflow run will also produce `pace-release-aab`, the signed bundle Play needs.
4. **Create the app** in Play Console. Use the text, graphics and answers in [`store/listing.md`](store/listing.md), and publish [`store/privacy-policy.md`](store/privacy-policy.md) at a public URL. Accept **Play App Signing**.
5. **Upload to Internal testing** first, for you and up to 100 testers. It's usually available within minutes to hours.
6. **Upload to Closed testing.** Invite at least 12 people who will install the app and keep it for 14 days.
7. **Apply for production access** from the Play Console dashboard, then roll out.

Each workflow run uses the GitHub run number as the `versionCode`, so every upload is higher than the last.

## Before a public release

- Check that "Pace" is free to use as a trademark and app name.
- Decide whether to keep the simulated "Connect a bank" flow. It's labelled as a demo, but a public app may be better without a feature that only pretends to work.
- Add a support email to the listing and the privacy policy.
- Test on a real phone: the back button, the keyboard over forms, attaching a receipt photo, and dark mode.

## Regenerating icons and store graphics

```sh
PLAYWRIGHT_MODULE=/path/to/playwright PACE_PAGE_URL=file:///path/to/pace/index.html node scripts/make-assets.mjs
```
