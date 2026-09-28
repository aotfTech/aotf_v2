// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import {
  sentryDsn,
  sentryReplaysSessionSampleRate,
  sentrySendDefaultPii,
  sentryTracesSampleRate,
} from "./lib/sentry-config";

Sentry.init({
  dsn: sentryDsn,

  integrations: [
    Sentry.consoleLoggingIntegration({
      levels: ["log", "warn", "error"],
    }),
    Sentry.replayIntegration({
      // Admin replay text is useful when diagnosing data-loading failures. Keep
      // input values masked because this page can contain user-entered data.
      maskAllText: false,
      maskAllInputs: true,

      // Capture detailed network information only for the posts API. This
      // includes request/response bodies and the explicitly allow-listed
      // headers, without exposing credentials or cookies in every replay.
      networkDetailAllowUrls: [/\/api\/v1\/posts(?:\/|$)/],
      networkCaptureBodies: true,
      networkRequestHeaders: ["accept", "content-type", "cache-control", "x-request-id"],
      networkResponseHeaders: [
        "cache-control",
        "content-length",
        "content-type",
        "etag",
        "x-request-id",
        "x-ratelimit-limit",
        "x-ratelimit-remaining",
      ],
    }),
  ],

  tracesSampleRate: sentryTracesSampleRate,

  enableLogs: true,

  replaysSessionSampleRate: sentryReplaysSessionSampleRate,

  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: sentrySendDefaultPii,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
