import { SITE_URL } from "@/lib/siteUrl";

function clean(value) { return String(value || "").trim(); }
function configuredEmail() { return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL); }
function configuredWhatsApp() { return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME); }

async function sendEmail(to, event, subscription) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject: event.title,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(event.summary || "Important CurrentPulse update")}</p><p><a href="${escapeHtml(event.url)}">Open official update on CurrentPulse →</a></p><p style="color:#64748b;font-size:12px">You received this because you subscribed to CurrentPulse alerts. <a href="${SITE_URL}/api/notifications/unsubscribe?token=${subscription.unsubscribe_token}">Unsubscribe</a></p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}

async function sendWhatsApp(to, event) {
  const version = clean(process.env.WHATSAPP_GRAPH_VERSION) || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE_NAME,
        language: { code: clean(process.env.WHATSAPP_TEMPLATE_LANGUAGE) || "en_US" },
        components: [{ type: "body", parameters: [
          { type: "text", text: event.title.slice(0, 180) },
          { type: "text", text: (event.summary || "Important update").slice(0, 300) },
          { type: "text", text: event.url.slice(0, 500) },
        ] }],
      },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp ${response.status}: ${await response.text()}`);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}

function wantsTopic(subscription, topic) {
  const topics = Array.isArray(subscription.topics) ? subscription.topics : [];
  return topics.includes("all") || topics.includes(topic);
}

async function claimDelivery(supabase, eventId, subscriptionId, channel) {
  const { data: existing, error: findError } = await supabase
    .from("notification_deliveries")
    .select("id,status")
    .eq("event_id", eventId)
    .eq("subscription_id", subscriptionId)
    .eq("channel", channel)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.status === "sent") return false;
  if (existing?.id) {
    const { error } = await supabase
      .from("notification_deliveries")
      .update({ status: "processing", error: null })
      .eq("id", existing.id);
    if (error) throw error;
    return true;
  }
  const { error } = await supabase.from("notification_deliveries").insert({
    event_id: eventId, subscription_id: subscriptionId, channel, status: "processing",
  });
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

async function loadSubscriberPage(supabase, offset, subscriberLimit) {
  const { data, error } = await supabase
    .from("notification_subscriptions")
    .select("id,email,phone_e164,email_enabled,whatsapp_enabled,topics,status,unsubscribe_token,created_at")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + subscriberLimit - 1);
  if (error) throw error;
  return data || [];
}

export async function dispatchNotificationBatch(
  supabase,
  { eventLimit = 1, subscriberLimit = 150 } = {}
) {
  const emailAvailable = configuredEmail();
  const whatsappAvailable = configuredWhatsApp();
  if (!emailAvailable && !whatsappAvailable) {
    return {
      processedEvents: 0,
      delivered: 0,
      failed: 0,
      notConfigured: true,
      emailConfigured: false,
      whatsappConfigured: false,
    };
  }

  const { data: events, error } = await supabase
    .from("notification_events")
    .select("id,topic,title,summary,url,status,delivery_offset")
    .in("status", ["pending", "partial"])
    .order("created_at", { ascending: true })
    .limit(eventLimit);
  if (error) {
    if (error.code === "42P01") {
      return { processedEvents: 0, delivered: 0, failed: 0, notConfigured: true };
    }
    if (error.code === "42703") {
      return {
        processedEvents: 0,
        delivered: 0,
        failed: 0,
        migrationRequired: true,
        message: "Run the 20260812 low-CPU automation migration before enabling notifications.",
      };
    }
    throw error;
  }
  if (!events?.length) return { processedEvents: 0, delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;
  let skippedUnavailableChannels = 0;
  let advancedSubscribers = 0;

  for (const event of events) {
    const offset = Math.max(0, Number(event.delivery_offset || 0));
    const subscriptions = await loadSubscriberPage(supabase, offset, subscriberLimit);
    let eventFailed = false;

    for (const sub of subscriptions) {
      if (!wantsTopic(sub, event.topic)) continue;
      const channels = [];
      if (sub.email_enabled && sub.email) {
        if (emailAvailable) channels.push(["email", sub.email]);
        else skippedUnavailableChannels += 1;
      }
      if (sub.whatsapp_enabled && sub.phone_e164) {
        if (whatsappAvailable) channels.push(["whatsapp", sub.phone_e164]);
        else skippedUnavailableChannels += 1;
      }

      for (const [channel, target] of channels) {
        try {
          if (!(await claimDelivery(supabase, event.id, sub.id, channel))) continue;
          if (channel === "email") await sendEmail(target, event, sub);
          else await sendWhatsApp(target, event);
          await supabase
            .from("notification_deliveries")
            .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
            .eq("event_id", event.id)
            .eq("subscription_id", sub.id)
            .eq("channel", channel);
          delivered += 1;
        } catch (sendError) {
          failed += 1;
          eventFailed = true;
          await supabase
            .from("notification_deliveries")
            .update({ status: "failed", error: String(sendError?.message || sendError).slice(0, 1000) })
            .eq("event_id", event.id)
            .eq("subscription_id", sub.id)
            .eq("channel", channel);
        }
      }
    }

    const hasMoreSubscribers = subscriptions.length === subscriberLimit;
    const nextOffset = eventFailed ? offset : offset + subscriptions.length;
    if (!eventFailed) advancedSubscribers += subscriptions.length;
    const nextStatus = eventFailed || hasMoreSubscribers ? "partial" : "sent";
    await supabase
      .from("notification_events")
      .update({
        status: nextStatus,
        delivery_offset: nextOffset,
        processed_at: nextStatus === "sent" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);
  }

  return {
    processedEvents: events.length,
    delivered,
    failed,
    advancedSubscribers,
    skippedUnavailableChannels,
    batchSize: subscriberLimit,
    emailConfigured: emailAvailable,
    whatsappConfigured: whatsappAvailable,
    site: SITE_URL,
  };
}
