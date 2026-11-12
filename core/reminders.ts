import { addMonths, daysBetween } from './dates';
import type { Car, DueReminder, IsoDate, ReminderType, Threshold } from './types';

export function reminderKey(carId: string, type: ReminderType, threshold: Threshold): string {
  return `${carId}:${type}:${threshold}`;
}

/** Reminders that should go out today, skipping the ones already sent. */
export function findDueReminders(
  cars: Car[],
  sentKeys: Set<string>,
  today: IsoDate,
): DueReminder[] {
  const result: DueReminder[] = [];

  for (const car of cars) {
    if (!car.remindersAccepted) continue;

    if (car.itpExpiry) {
      const d = daysBetween(today, car.itpExpiry);
      let threshold: Threshold | undefined;
      if (d > 7 && d <= 30) threshold = 30;
      else if (d >= 0 && d <= 7) threshold = 7;
      if (threshold) {
        const key = reminderKey(car.id, 'itp', threshold);
        if (!sentKeys.has(key)) {
          result.push({
            carId: car.id,
            type: 'itp',
            threshold,
            daysLeft: d,
            key,
            alsoMarkSent: threshold === 7 ? [reminderKey(car.id, 'itp', 30)] : [],
          });
        }
      }
    }

    if (car.lastOilChange) {
      const d = daysBetween(today, addMonths(car.lastOilChange, 12));
      if (d <= 14) {
        const key = reminderKey(car.id, 'ulei', 14);
        if (!sentKeys.has(key)) {
          result.push({ carId: car.id, type: 'ulei', threshold: 14, daysLeft: d, key, alsoMarkSent: [] });
        }
      }
    }
  }

  return result;
}
