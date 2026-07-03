import * as Notifications from 'expo-notifications';
import { getDb } from '../db';
import { getSetting, setSetting } from '../db/queries';
import { hasImportThisWeek } from '../db/queries';

const NOTIF_ID_KEY = 'weekly_notif_id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWeeklyReminder(
  weekday: number,
  hour: number,
  minute: number
): Promise<void> {
  const db = await getDb();
  const existingId = await getSetting(db, NOTIF_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
  }

  const alreadyImported = await hasImportThisWeek(db);
  const body = alreadyImported
    ? "You're up to date ✅ — great job keeping your finances tracked!"
    : "Time to upload this week's bank statement 📄";

  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'BudgetVault', body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
    },
  });

  await setSetting(db, NOTIF_ID_KEY, id);
}

export async function cancelWeeklyReminder(): Promise<void> {
  const db = await getDb();
  const id = await getSetting(db, NOTIF_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await setSetting(db, NOTIF_ID_KEY, '');
  }
}

export async function syncReminderFromSettings(): Promise<void> {
  const db = await getDb();
  const enabled = await getSetting(db, 'reminder_enabled');
  if (enabled === 'false') { await cancelWeeklyReminder(); return; }

  const day = parseInt((await getSetting(db, 'reminder_day')) ?? '1', 10);
  const hour = parseInt((await getSetting(db, 'reminder_hour')) ?? '18', 10);
  const minute = parseInt((await getSetting(db, 'reminder_minute')) ?? '0', 10);
  // expo-notifications weekday: 1=Sunday … 7=Saturday
  await scheduleWeeklyReminder(day === 0 ? 1 : day + 1, hour, minute).catch(console.error);
}
