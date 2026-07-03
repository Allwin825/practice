# BudgetVault — Privacy Policy

**Last updated:** 2026-07-03

---

## Overview

BudgetVault is a privacy-first personal finance tracker. Your financial data never leaves your device. This policy explains what data we collect (nothing), how we store it (locally), and your rights over it (full control).

---

## Data We Collect

**We collect no data whatsoever.** BudgetVault has no backend servers, no analytics, no crash reporters, and no advertising SDKs. The app contains zero network calls to external services.

You can verify this yourself: the app's CI pipeline runs a grep check on every commit to confirm no `fetch()` or `axios` calls exist in the source code.

---

## Data You Store Locally

All data you enter or import is stored **only on your device**, in a local SQLite database:

| Data type | Where stored | Who can access |
|---|---|---|
| Bank statements (imported) | On-device SQLite | You only |
| Transaction history | On-device SQLite | You only |
| Budget plans | On-device SQLite | You only |
| Category rules | On-device SQLite | You only |
| App settings | On-device SQLite | You only |
| Encryption key | Android Keystore / iOS Keychain | You only (device-locked) |

---

## Cloud Backup

Android's automatic cloud backup is **disabled** (`android.allowBackup: false` in AndroidManifest.xml). Your financial data is never uploaded to Google Drive, iCloud, or any other cloud service.

---

## Encryption

The app generates a 256-bit random encryption key on first run and stores it in the device's secure hardware-backed keystore (Android Keystore / iOS Keychain). The key is bound to the device and accessible only while the device is unlocked.

Full database encryption (SQLCipher) is planned for a future release when the native build toolchain is configured.

---

## Biometric Authentication

If you enable biometric lock, the app uses the device's local biometric system (fingerprint / face) to gate access. No biometric data is ever processed or stored by BudgetVault. All authentication is handled by the device OS.

---

## Export / Backup

You can export your data as JSON or CSV at any time from the Settings screen. These exports are shared via the device's native share sheet and are immediately deleted from the app's cache directory after sharing. BudgetVault does not retain copies of exported files.

---

## Notifications

The app sends local weekly reminders using the device's notification system. These notifications are scheduled locally and are not sent through any external push notification service.

---

## Permissions

| Permission | Purpose |
|---|---|
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | Optional biometric lock |
| `READ_EXTERNAL_STORAGE` (Android < 13) | Picking CSV/XLSX files to import |
| `POST_NOTIFICATIONS` (Android 13+) | Weekly import reminders |

No location, contacts, microphone, camera, or advertising ID permissions are requested.

---

## Data Deletion

To delete all your data:
1. Open Settings → scroll to the bottom → tap "Wipe All Data" (if available), or
2. Uninstall the app. All data is removed with the app.

Because data is stored only on your device, there is no server-side deletion request necessary.

---

## Children

BudgetVault is not directed at children under 13. We do not knowingly collect any information from children.

---

## Changes to This Policy

If we change how data is handled (e.g., when adding SQLCipher encryption), we will update this document and bump the "Last updated" date. Because BudgetVault collects no personal data, there are no consent flows to update in the app.

---

## Contact

For questions, open an issue at: https://github.com/Allwin825/practice/issues
