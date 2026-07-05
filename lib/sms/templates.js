// lib/sms/templates.js
// Mirrors app/admin/lib/email/templates.js — one function per message type, plain text
// (no HTML), kept short since SMS has a practical length ceiling before it splits into
// multiple segments and costs more per send.

export function onMyWayText({ companyName, workerName, eta }) {
  return `${companyName}: ${workerName} is on the way${eta ? `, ETA ${eta}` : ""}. Reply if you need to reschedule.`;
}

export function appointmentReminderText({
  companyName,
  scheduledAt,
  location,
}) {
  const when = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${companyName}: Reminder — your appointment is ${when}${location ? ` at ${location}` : ""}. Reply STOP to opt out.`;
}

export function bookingConfirmationText({
  companyName,
  eventTypeName,
  startTime,
}) {
  const when = new Date(startTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${companyName}: You're booked for ${eventTypeName} on ${when}. See you then!`;
}

export function quoteReadyText({ companyName, quoteUrl }) {
  return `${companyName}: Your quote is ready to view — ${quoteUrl}`;
}

export function invoiceOverdueText({
  companyName,
  invoiceNumber,
  amount,
  payUrl,
}) {
  return `${companyName}: Invoice ${invoiceNumber} ($${amount}) is overdue. Pay online: ${payUrl}`;
}

export function jobCompleteText({ companyName, invoiceUrl }) {
  return `${companyName}: Your job is complete! Your invoice is ready — ${invoiceUrl}`;
}
