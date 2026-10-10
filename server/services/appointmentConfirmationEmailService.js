'use strict';

const {
  APPOINTMENT_TYPE_LABELS,
  escapeHtml,
  formatWhen,
  buildEmailShell,
  loadEmailContext,
  sendMailSafe,
  buildIcsAttachment,
  buildCancelIcsAttachment
} = require('../utils/appointmentEmailUtils');
const { buildManageUrl } = require('../utils/appointmentManageToken');

function detailBlock({ when, hostName, orgName, meetingLink, location, appointmentTypeLabel }) {
  const rows = [
    ['When', `${when.dateLine}<br><span style="color:#52525b;">${escapeHtml(when.timeLine)}</span>`],
    ['With', escapeHtml(hostName)],
    ['Type', escapeHtml(appointmentTypeLabel)]
  ];
  if (meetingLink) {
    rows.push([
      'Join',
      `<a href="${escapeHtml(meetingLink)}" style="color:#4f46e5;">${escapeHtml(meetingLink)}</a>`
    ]);
  } else if (location) {
    rows.push(['Location', escapeHtml(location)]);
  }
  if (orgName) {
    rows.push(['From', escapeHtml(orgName)]);
  }

  return rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:10px 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;">${label}</td>
      </tr>
      <tr>
        <td style="padding:0 0 12px;font-size:15px;color:#18181b;line-height:1.5;">${value}</td>
      </tr>`
    )
    .join('');
}

function buildGuestConfirmationContent({
  guestName,
  eventName,
  when,
  hostName,
  orgName,
  meetingLink,
  location,
  appointmentTypeLabel,
  manageUrl
}) {
  const subject = `Confirmed: ${eventName}`;
  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${escapeHtml(guestName)}, your appointment is confirmed.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      ${detailBlock({ when, hostName, orgName, meetingLink, location, appointmentTypeLabel })}
    </table>
    <p style="margin:20px 0 0;font-size:14px;color:#52525b;line-height:1.5;">
      Add this event to your calendar using the attached invite, or save the meeting link above.
    </p>
    ${
      manageUrl
        ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(manageUrl)}" style="font-size:14px;color:#4f46e5;">Reschedule or cancel this appointment</a></p>`
        : ''
    }`;

  const text = [
    `Hi ${guestName},`,
    '',
    'Your appointment is confirmed.',
    '',
    eventName,
    when.dateLine,
    when.timeLine,
    `With: ${hostName}`,
    `Type: ${appointmentTypeLabel}`,
    meetingLink ? `Join: ${meetingLink}` : location ? `Location: ${location}` : null,
    orgName ? `From: ${orgName}` : null,
    manageUrl ? `Manage: ${manageUrl}` : null
  ]
    .filter(Boolean)
    .join('\n');

  const html = buildEmailShell({
    title: "You're booked",
    bodyHtml,
    accentColor: '#059669'
  });

  return { subject, text, html };
}

function buildHostNotificationContent({
  guestName,
  guestEmail,
  eventName,
  when,
  hostName,
  eventUrl
}) {
  const subject = `New booking: ${eventName}`;
  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${escapeHtml(hostName)}, ${escapeHtml(guestName)} (${escapeHtml(guestEmail)}) booked an appointment with you.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:0 0 8px;font-size:15px;font-weight:600;color:#18181b;">${escapeHtml(eventName)}</td></tr>
      <tr><td style="padding:0 0 4px;font-size:15px;color:#18181b;">${escapeHtml(when.dateLine)}</td></tr>
      <tr><td style="padding:0 0 16px;font-size:15px;color:#52525b;">${escapeHtml(when.timeLine)}</td></tr>
    </table>
    ${
      eventUrl
        ? `<p style="margin:0;"><a href="${escapeHtml(eventUrl)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View in Arivu</a></p>`
        : ''
    }`;

  const text = [
    `Hi ${hostName},`,
    '',
    `${guestName} (${guestEmail}) booked an appointment with you.`,
    '',
    eventName,
    when.dateLine,
    when.timeLine,
    eventUrl ? `View: ${eventUrl}` : null
  ]
    .filter(Boolean)
    .join('\n');

  const html = buildEmailShell({ title: 'New appointment', bodyHtml });
  return { subject, text, html };
}

function buildCancellationContent({ recipientName, eventName, when, cancelledByLabel }) {
  const subject = `Cancelled: ${eventName}`;
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${escapeHtml(recipientName)}, your appointment has been cancelled${cancelledByLabel ? ` (${escapeHtml(cancelledByLabel)})` : ''}.
    </p>
    <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">${escapeHtml(eventName)}</p>
    <p style="margin:4px 0 0;font-size:14px;color:#52525b;">${escapeHtml(when.dateLine)} · ${escapeHtml(when.timeLine)}</p>`;

  const text = [
    `Hi ${recipientName},`,
    '',
    `Your appointment has been cancelled${cancelledByLabel ? ` (${cancelledByLabel})` : ''}.`,
    '',
    eventName,
    when.dateLine,
    when.timeLine
  ].join('\n');

  const html = buildEmailShell({
    title: 'Appointment cancelled',
    bodyHtml,
    accentColor: '#dc2626'
  });
  return { subject, text, html };
}

function eventRecordUrl(eventId) {
  const { resolveClientUrl } = require('../utils/clientUrl');
  const base = resolveClientUrl();
  return `${base}/events/${eventId}`;
}

/**
 * Send guest confirmation + host notification after a public booking.
 */
async function sendAppointmentConfirmationEmails({ event, config, guest }) {
  if (!guest?.email) return;

  const organizationId = event.organizationId;
  const hostUserId = event.assignedTo;
  const timezone =
    event.appointment?.customerTimezone || config.workingHours?.timezone || 'UTC';
  const { orgName, hostName, hostEmail } = await loadEmailContext(organizationId, hostUserId);

  const when = formatWhen(event.startDateTime, event.endDateTime, timezone);
  const appointmentTypeLabel =
    APPOINTMENT_TYPE_LABELS[event.appointment?.appointmentType] || 'Meeting';
  const meetingLink = event.appointment?.meetingLink || event.location || '';
  const location =
    !meetingLink && config.meetingType === 'offline' ? event.location || 'In person' : '';
  const guestName =
    event.appointment?.bookedByName ||
    [guest.firstName, guest.lastName].filter(Boolean).join(' ').trim() ||
    guest.email;

  const manageUrl = event.appointment?.manageToken
    ? buildManageUrl(event.appointment.manageToken)
    : null;

  const guestContent = buildGuestConfirmationContent({
    guestName,
    eventName: event.eventName,
    when,
    hostName,
    orgName,
    meetingLink: meetingLink || null,
    location,
    appointmentTypeLabel,
    manageUrl
  });

  const ics = buildIcsAttachment({
    event,
    hostName,
    guestEmail: guest.email,
    meetingLink
  });

  let guestResult = await sendMailSafe({
    organizationId,
    to: guest.email,
    ...guestContent,
    replyTo: hostEmail || undefined,
    attachments: [ics]
  });
  if (!guestResult.success && !guestResult.skipped && guestResult.error) {
    guestResult = await sendMailSafe({
      organizationId,
      to: guest.email,
      ...guestContent,
      replyTo: hostEmail || undefined
    });
  }

  if (hostEmail && hostEmail.toLowerCase() !== String(guest.email).toLowerCase()) {
    const hostContent = buildHostNotificationContent({
      guestName,
      guestEmail: guest.email,
      eventName: event.eventName,
      when,
      hostName,
      eventUrl: eventRecordUrl(event._id)
    });

    await sendMailSafe({
      organizationId,
      to: hostEmail,
      ...hostContent,
      replyTo: guest.email
    });
  }

  if (event.appointment) {
    event.appointment.confirmationEmailSentAt = new Date();
    if (event.appointment.reminderStatus !== 'none') {
      event.appointment.reminderStatus = 'pending';
    }
    try {
      await event.save();
    } catch (err) {
      console.warn('[appointmentConfirmationEmail] confirmation timestamp update failed:', err.message);
    }
  }
}

/**
 * Notify guest when an appointment is cancelled.
 */
async function sendAppointmentCancellationEmail({ event, reason }) {
  const guestEmail = event.appointment?.bookedByEmail;
  if (!guestEmail) return;

  const organizationId = event.organizationId;
  const timezone = event.appointment?.customerTimezone || 'UTC';
  const guestName = event.appointment?.bookedByName || guestEmail;
  const when = formatWhen(event.startDateTime, event.endDateTime, timezone);
  const cancelledByLabel =
    event.appointment?.cancellationSource === 'customer' ? 'cancelled by you' : reason || null;

  const content = buildCancellationContent({
    recipientName: guestName,
    eventName: event.eventName,
    when,
    cancelledByLabel
  });

  const ics = buildCancelIcsAttachment({ event });

  await sendMailSafe({
    organizationId,
    to: guestEmail,
    ...content,
    attachments: [ics]
  });

}

module.exports = {
  sendAppointmentConfirmationEmails,
  sendAppointmentCancellationEmail,
  formatWhen,
  buildGuestConfirmationContent,
  buildIcsAttachment
};
