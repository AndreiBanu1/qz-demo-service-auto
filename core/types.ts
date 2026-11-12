export type IsoDate = string; // 'YYYY-MM-DD', Bucharest calendar
export type Status = 'primita' | 'in-lucru' | 'gata' | 'predata';
export type Work = 'revizie' | 'ulei' | 'itp' | 'frane' | 'diagnoza';
export type Appointment = {
  id: string;
  token: string;
  firstName: string;
  email: string;
  car: { make: string; model: string };
  work: Work;
  preferredDate: IsoDate;
  status: Status;
  createdAt: string;
  updatedAt: string;
  seed: boolean;
};
export type Car = {
  id: string;
  appointmentId?: string;
  firstName: string;
  email: string;
  make: string;
  model: string;
  itpExpiry?: IsoDate;
  lastOilChange?: IsoDate;
  remindersAccepted: boolean;
  seed: boolean;
  createdAt: string;
};
export type ReminderType = 'itp' | 'ulei';
export type Threshold = 30 | 7 | 14;
export type DueReminder = {
  carId: string;
  type: ReminderType;
  threshold: Threshold;
  daysLeft: number;
  key: string;
  alsoMarkSent: string[];
};
export type Job = 'confirmare-programare' | 'masina-gata' | 'remindere-zilnice' | 'curatenie';
export type Trigger = 'cron' | 'buton' | 'formular' | 'schimbare-status';
export type Outcome = 'trimis-sandbox' | 'simulat' | 'netrimis-limita' | 'eroare';
export type Channel = 'email' | 'sms-simulat';
export type RunItem = {
  channel: Channel;
  to: string;
  subject: string;
  outcome: Outcome;
  error?: string;
};
export type Run = {
  id: string;
  job: Job;
  trigger: Trigger;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  result: 'ok' | 'eroare' | 'nimic-de-trimis';
  items: RunItem[];
  error?: string;
};
export type OutboxMessage = {
  id: string;
  runId: string;
  channel: Channel;
  to: string;
  subject: string;
  body: string;
  outcome: Outcome;
  createdAt: string;
  appointmentId?: string;
};
