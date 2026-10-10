# Releasing to the App Store and Google Play

The iOS and Android apps are [Capacitor](https://capacitorjs.com) shells
(`ios/`, `android/`, `capacitor.config.ts`) that load the deployed site. The
chat, voice and TTS need the server, so there is no offline bundle. The shells
add what a browser can't:

- the system location prompt and API, via `@capacitor/geolocation` (see `lib/location.ts`)
- microphone access for hold-to-talk
- an app icon and splash screen
- edge-to-edge layout around the notch (`--safe-top` / `--safe-bottom`)
- a bundled "no connection" screen (`mobile/www/offline.html`)

**What needs a new store build, and what doesn't.** A web deploy
(`bun run deploy`) updates both apps at once, with no store review. You only
need a new store build when something native changes:

- plugins
- permissions
- icons or splash
- `capacitor.config.ts`
- the server URL

## 0. Before the first submission

| What                         | Where                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App ID (permanent once live) | `appId` in `capacitor.config.ts`, then `bunx cap sync`. Also update `applicationId` in `android/app/build.gradle` and `PRODUCT_BUNDLE_IDENTIFIER` in Xcode. Now `com.quangtri.travelguide`. |
| Support email                | Set `NEXT_PUBLIC_SUPPORT_EMAIL` in the Cloudflare deploy. It appears on About and Privacy. Both stores require a contact.                                                                   |
| Answer reports table         | Apply `supabase/migrations/0004_answer_reports.sql` to the production database.                                                                                                             |
| Reviewed content             | Production runs with `CONTENT_REQUIRE_REVIEWED=false`. Get the war-history sections reviewed first, because reviewers and early users will read them.                                       |
| Photos                       | Open each place page on the deploy and check that the Wikimedia photo loads (see `lib/sample-sites.ts`).                                                                                    |
| Icon                         | `public/icon-maskable-512.png` is the source. For a crisper App Store icon, replace it with a 1024 px master, then run `bun run mobile:assets`.                                             |

Accounts:

- **Apple Developer Program:** US$99/year. You need a Mac with a current Xcode.
- **Google Play Console:** US$25 once. New personal accounts must run a
  closed test with at least 12 testers for 14 days before they can publish to
  production. Start that early.

## 1. Android (Google Play)

**Try it on a phone first.** The **Mobile** GitHub workflow builds a debug APK for every PR that touches the shell. You can also start it by hand from **Actions → Mobile → Run workflow**. Download `quang-tri-debug-apk` from the run, then install it. On Android, allow "install unknown apps" for your browser or file manager. The same run, with the iOS box ticked, compiles the iOS project for the simulator.

```bash
bun install
bun run mobile:sync          # copies config + plugins into android/
bun run mobile:android       # opens Android Studio
```

1. In Android Studio, go to **Build → Generate Signed App Bundle → Android App Bundle**.
2. Create an upload keystore and keep it, with its passwords, somewhere safe outside the repo.
3. In Play Console, create the app and turn on **Play App Signing**.
4. Upload the `.aab` to **Testing → Closed testing** and invite your 12+ testers.
5. For each later upload, bump `versionCode` (and `versionName`) in `android/app/build.gradle`.

## 2. iOS (App Store)

On a Mac:

```bash
bun install
bun run mobile:sync
bun run mobile:ios           # opens Xcode
```

1. Select the **App** target. Under **Signing & Capabilities**, pick your Team.
2. Choose **Product → Archive**, then **Distribute App → App Store Connect**.
3. Test through **TestFlight** first, then submit for review.
4. For each later upload, bump **Version** (`MARKETING_VERSION`) and **Build** (`CURRENT_PROJECT_VERSION`).

The app is iPhone-only and portrait. That means no iPad screenshots are needed.

## 3. Store listing text

|                         | Tiếng Việt                                                                 | English                                                                      |
| ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Name (≤ 30)             | Quảng Trị – Hướng dẫn viên                                                 | Quảng Trị Travel Guide                                                       |
| Subtitle / short (≤ 30) | Di tích, câu chuyện, lịch trình                                            | Sites, stories and day plans                                                 |
| Play short desc. (≤ 80) | Hướng dẫn viên AI song ngữ cho các di tích và chuyến đi ở Quảng Trị.       | A bilingual AI guide to Quảng Trị's historic sites and trips.                |
| Category                | Du lịch                                                                    | Travel                                                                       |
| iOS keywords (≤ 100)    | quang tri,di tich,vinh moc,hien luong,khe sanh,du lich,ben hai,la vang,dmz | quang tri,dmz,vinh moc,khe sanh,vietnam war,hue,travel guide,ben hai,tunnels |

**Description (EN).**

> Your guide to Quảng Trị, in English and Vietnamese.
>
> • Hear the story of each place when you arrive: Vịnh Mốc Tunnels, Hiền Lương Bridge, Khe Sanh, Trường Sơn Cemetery, La Vang and more.
> • Ask anything by voice or text. History answers come from edited content and show their sources.
> • Choose how you travel: war history, a first visit, or a family trip.
> • Plan your day with travel times between sites.
>
> No account needed. Location and microphone are only used when you turn them on.

**Description (VI).**

> Hướng dẫn viên Quảng Trị của bạn, bằng tiếng Việt và tiếng Anh.
>
> • Nghe câu chuyện của từng nơi khi bạn đến: Địa đạo Vịnh Mốc, Cầu Hiền Lương, Khe Sanh, Nghĩa trang Trường Sơn, La Vang…
> • Hỏi bất cứ điều gì bằng giọng nói hoặc chữ. Câu trả lời về lịch sử dựa trên nội dung đã biên tập và có dẫn nguồn.
> • Chọn kiểu chuyến đi: lịch sử chiến tranh, lần đầu đến, hoặc du lịch gia đình.
> • Lên lịch trình trong ngày kèm thời gian di chuyển.
>
> Không cần tài khoản. Vị trí và micrô chỉ dùng khi bạn bật.

**URLs.**

- Privacy policy: `https://<deploy>/privacy`
- Terms: `https://<deploy>/terms`
- Support: `https://<deploy>/about` (it shows the support email)

## 4. Screenshots

```bash
bun run build && bun run start &                 # or point at the deploy
bun run store:screenshots https://<deploy>       # live photos + map tiles
```

This writes the following to `store/screenshots/`:

- `ios/<lang>/*.png` at 1320 × 2868, the 6.9″ iPhone size
- `android/<lang>/*.png` at 1080 × 1920

Upload the `vi` set for Vietnamese and the `en` set for English. Google Play
also needs a 1024 × 500 feature graphic.

## 5. Privacy questionnaires

Each item below matches what `/privacy` says. Update both if the code changes.

| Data                  | Collected?                                | Linked to user | Tracking | Purpose                                |
| --------------------- | ----------------------------------------- | -------------- | -------- | -------------------------------------- |
| Precise location      | Yes, sent with "near me" questions        | No             | No       | App functionality                      |
| Audio (voice)         | Yes, transcribed then discarded           | No             | No       | App functionality                      |
| Other user content    | Questions, answer reports                 | No             | No       | App functionality, product improvement |
| Identifiers / contact | No                                        | –              | –        | –                                      |
| Analytics             | No (`posthog-js` is installed but unused) | –              | –        | –                                      |

Fill in the rest as follows:

- **Google Play Data safety:** data is encrypted in transit (HTTPS). Users
  can't request deletion in-app because there is no account. Say so, and
  point to the support email.
- **Apple:** "Data not used to track you". The app uses no third-party
  advertising SDKs.

Content rating answers:

- Play IARC and Apple age rating both cover **references to war and historical violence**, with no graphic depictions.
- The app has **AI-generated content**. In-app reporting is available through the **Report** button on every answer.
- Both stores will likely land on Teen/12+ or lower.

## 6. Notes for the reviewers

Paste into App Store Connect → App Review Information → Notes, and into Play Console → App access:

> No login is required. The app is a travel guide for Quảng Trị Province, Vietnam. Location features (nearby sites, arrival stories) only trigger inside the province, so from elsewhere please use the map and the "Ask the guide" chat. Try: "When were the Vịnh Mốc tunnels dug?" or hold the mic button and ask by voice. Every answer has a Report button for wrong or offensive content.

Apple guideline 4.2 rejects "repackaged websites". If a reviewer raises it, point to:

- native location with arrival stories
- hold-to-talk voice questions with spoken answers
- the offline screen
- the in-app plan

## 7. Later

- Push notifications, for example a nudge when you reach a site, would add another native feature. They need `@capacitor/push-notifications` plus APNs and FCM setup.
- Deep links (`/site/<slug>` opening in the app) need `apple-app-site-association` and `assetlinks.json` served from the deploy.
