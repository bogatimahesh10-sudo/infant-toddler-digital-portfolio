# Pace for Android and iOS

This wraps the Pace prototype (`../pace`) as Android and iOS apps using [Capacitor](https://capacitorjs.com). The screens and money logic are the same code as the web prototype. Capacitor packages it into native apps that work offline.

- **App ID / bundle ID:** `com.bogatimahesh.pace`. To change it, edit `capacitor.config.json`, `android/app/build.gradle` and `PRODUCT_BUNDLE_IDENTIFIER` in `ios/App/App.xcodeproj`. Do this **before the first upload to either store**. After that it can never change.
- **Minimum Android:** 7.0 (API 24), targeting API 36. **Minimum iOS:** 15, iPhone only.
- **The store builds differ from the web prototype:** they open on first-time setup instead of sample data, they bundle the Inter font so they need no internet, and the Android back button steps back through screens and sheets before leaving the app. They also leave out features that only simulate something: the bank connection, the app lock, notification switches, bill reminders and the prototype tools.

## Build it

GitHub builds it automatically. Every push that changes `pace/` or `mobile/` runs `.github/workflows/mobile.yml`. That builds the Android APK and checks that the iOS app compiles for the simulator. Open the run under **Actions** and download `pace-debug-apk` from **Artifacts**.

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

## Apple App Store

There's no 12-tester rule like Google's, but there are three requirements:

- **An Apple Developer Program membership.** It costs US$99 a year (about A$149). Individuals verify their identity, which usually takes a day or two. Organisations need a D-U-N-S number.
- **A Mac with Xcode,** for signing and uploading. A cloud Mac or a CI service such as Codemagic or GitHub's macOS runners can do it instead, but using your own Mac is simplest the first time.
- **App Review.** Apple reviews every release. Most reviews finish within a day or two.

### Release to the App Store from GitHub (no Mac needed)

The **Mobile builds** workflow can sign the iOS app and upload it to App Store Connect, using an App Store Connect API key. Xcode manages the signing certificate in the cloud, so you don't need to handle certificate files.

1. **Enrol** in the Apple Developer Program (see below) and wait for it to be approved.
2. **Register the bundle ID.** Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list), choose **Identifiers**, then **+**. Pick **App IDs**, then **App**. Enter the description `Pace` and the explicit bundle ID `com.bogatimahesh.pace`.
3. **Create the app record** in [App Store Connect](https://appstoreconnect.apple.com) under **Apps → + → New App**. Choose iOS, enter the name from `store/listing.md`, the bundle ID `com.bogatimahesh.pace` and any SKU, such as `pace-001`.
4. **Create an API key.** Go to App Store Connect, then **Users and Access → Integrations → App Store Connect API → Team Keys → +**. Give the key the **Admin** role, which is needed for cloud-managed signing. Download the `.p8` file. Apple only lets you download it once. Note the **Key ID** and the **Issuer ID**.
5. **Find your Team ID** at [developer.apple.com/account](https://developer.apple.com/account), under **Membership details**.
6. **Add four repository secrets** in GitHub (Settings → Secrets and variables → Actions):
   - `APPSTORE_KEY_ID`: the Key ID
   - `APPSTORE_ISSUER_ID`: the Issuer ID
   - `APPSTORE_PRIVATE_KEY`: the whole contents of the `.p8` file, including the BEGIN and END lines
   - `APPLE_TEAM_ID`: your Team ID
7. **Run the release.** Go to **Actions → Mobile builds → Run workflow**, tick **Sign and upload the iOS app**, enter the version (for example `1.0.0`), and run it. The build number is the run number, so every upload is higher than the last.
8. After Apple finishes processing, usually 10–30 minutes, the build appears under **TestFlight**. Install it on your iPhone with the TestFlight app.
9. Fill in the listing (step 7 in the Mac steps below), add the build to the version, and choose **Submit for Review**.

If the release job fails, the log shows which step failed. Common causes are a key without the Admin role, a bundle ID that isn't registered yet, or a version number that has already been used.

### Release from a Mac with Xcode

Steps:

1. **Enrol** at [developer.apple.com/programs](https://developer.apple.com/programs/).
2. **Open the project on a Mac:**
   ```sh
   git clone https://github.com/bogatimahesh10-sudo/smart-portfolio.git
   cd smart-portfolio/mobile
   npm ci
   npm run sync:ios
   npx cap open ios
   ```
   In Xcode, select the **App** target, then go to **Signing & Capabilities**. Tick **Automatically manage signing** and choose your team. Xcode registers the bundle ID for you.
3. **Try it on your iPhone.** Plug the phone in, select it as the run destination, and press **Run**.
4. **Create the app** in [App Store Connect](https://appstoreconnect.apple.com) under **Apps → + → New App**. Choose iOS, use the name from `store/listing.md`, and select the bundle ID `com.bogatimahesh.pace`. The SKU can be anything, for example `pace-001`.
5. **Upload a build.** In Xcode, set the destination to **Any iOS Device**, then choose **Product → Archive → Distribute App → App Store Connect → Upload**. Raise the build number (`CURRENT_PROJECT_VERSION`) for every upload.
6. **TestFlight.** Internal testers (up to 100 people on your team) can install straight away. External testers need a short beta review first.
7. **Fill in the listing:**
   - **Screenshots:** `store/ios/iphone-*.png`, 1290×2796, which fits the 6.9-inch slot.
   - **Description:** reuse `store/listing.md`.
   - **Category:** Finance.
   - **Privacy policy URL** and **Support URL:** both are required.
   - **App Privacy:** choose **Data Not Collected**.
   - **Age rating:** answer the questionnaire. Nothing in Pace raises it.
   - **Export compliance:** already answered in `Info.plist` (`ITSAppUsesNonExemptEncryption` = NO).
8. **Submit for review,** then release manually or automatically once it's approved.

Two review risks to deal with before submitting:

- **Guideline 4.2 (minimum functionality).** Apple rejects apps that are just a website in a wrapper. Pace runs fully offline and has real features, which helps. Explain this in the review notes, for example: *"All features work offline on the device. There is no account or server."*
- **Guideline 2.3 (accurate metadata).** Store builds already leave out the simulated bank connection, the simulated app lock, the notification switches (no notifications are sent) and the prototype tools. Only the web prototype keeps them.

## Before a public release

- Check that "Pace" is free to use as a trademark and app name.
- Add a support email to the listing and the privacy policy.
- Test on a real phone: the back button, the keyboard over forms, attaching a receipt photo, and dark mode.

## Regenerating icons and store graphics

```sh
PLAYWRIGHT_MODULE=/path/to/playwright PACE_PAGE_URL=file:///path/to/pace/index.html node scripts/make-assets.mjs
```
