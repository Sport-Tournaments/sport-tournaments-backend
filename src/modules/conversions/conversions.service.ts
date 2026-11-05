import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { getRequestContext } from './request-context';

/** GA4 event names (recommended names where one exists). */
export type ConversionEvent =
  | 'sign_up'
  | 'email_verified'
  | 'create_club'
  | 'create_team'
  | 'create_tournament'
  | 'publish_tournament'
  | 'tournament_registration'
  | 'registration_approved'
  | 'registration_rejected'
  | 'registration_withdrawn'
  | 'purchase';

type ParamValue = string | number | boolean | undefined | null;

export interface ConversionDetails {
  userId?: string;
  /** GA4 event parameters (also shown in the Discord message). */
  params?: Record<string, ParamValue>;
  /** Human-readable summary line, sent to Discord only (may contain names). */
  summary?: string;
  /**
   * Attribute the GA event to the browser that made the current request.
   * Set false when someone else triggered it (organizer approving, Stripe webhook).
   */
  attributeToRequest?: boolean;
}

const DISCORD_TITLES: Record<ConversionEvent, string> = {
  sign_up: '🆕 New sign-up',
  email_verified: '📧 Email verified',
  create_club: '🏟️ Club created',
  create_team: '👕 Team created',
  create_tournament: '🏆 Tournament created',
  publish_tournament: '📣 Tournament published',
  tournament_registration: '📝 Team registered for a tournament',
  registration_approved: '✅ Registration approved',
  registration_rejected: '❌ Registration rejected',
  registration_withdrawn: '↩️ Registration withdrawn',
  purchase: '💶 Payment completed',
};

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Sends business conversion events to a Discord channel (DISCORD_WEBHOOK_URL)
 * and to GA4 via the Measurement Protocol (GA_MEASUREMENT_ID + GA_API_SECRET).
 * Fire-and-forget: tracking never delays or fails the request that triggered it.
 */
@Injectable()
export class ConversionsService {
  private readonly logger = new Logger(ConversionsService.name);

  constructor(private readonly configService: ConfigService) {}

  track(event: ConversionEvent, details: ConversionDetails = {}): void {
    const gaClientId =
      details.attributeToRequest === false
        ? undefined
        : getRequestContext()?.gaClientId;
    void Promise.allSettled([
      this.sendToDiscord(event, details),
      this.sendToGoogleAnalytics(event, details, gaClientId),
    ]);
  }

  private async sendToDiscord(
    event: ConversionEvent,
    { params = {}, summary }: ConversionDetails,
  ): Promise<void> {
    const url = this.configService.get<string>('conversions.discordWebhookUrl');
    if (!url) return;

    const fields = Object.entries(params)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      )
      .slice(0, 25)
      .map(([name, value]) => ({
        name,
        value: String(value).slice(0, 1024),
        inline: true,
      }));

    await this.post(
      url,
      {
        username: 'Tournamente',
        embeds: [
          {
            title: DISCORD_TITLES[event],
            description: summary?.slice(0, 4096),
            color: 0x1e3a5f,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      },
      'Discord',
    );
  }

  private async sendToGoogleAnalytics(
    event: ConversionEvent,
    { userId, params = {} }: ConversionDetails,
    gaClientId?: string,
  ): Promise<void> {
    const measurementId = this.configService.get<string>(
      'conversions.gaMeasurementId',
    );
    const apiSecret = this.configService.get<string>('conversions.gaApiSecret');
    if (!measurementId || !apiSecret) return;

    const eventParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== undefined && value !== null,
      ),
    );

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
      measurementId,
    )}&api_secret=${encodeURIComponent(apiSecret)}`;

    await this.post(
      url,
      {
        // Without the browser's id the event still counts, but loses attribution.
        client_id: gaClientId ?? this.fallbackClientId(userId),
        ...(userId && { user_id: userId }),
        events: [
          {
            name: event,
            params: { ...eventParams, engagement_time_msec: 1 },
          },
        ],
      },
      'Google Analytics',
    );
  }

  /** Stable pseudo client id ("<int>.<int>") so one user maps to one GA client. */
  private fallbackClientId(userId?: string): string {
    if (!userId) return `${Date.now()}.${Math.floor(Math.random() * 1e9)}`;
    const hash = createHash('sha256').update(userId).digest();
    return `${hash.readUInt32BE(0)}.${hash.readUInt32BE(4)}`;
  }

  private async post(url: string, body: unknown, target: string) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(
          `${target} conversion event failed: ${response.status}`,
        );
      }
    } catch (error) {
      this.logger.warn(`${target} conversion event failed: ${String(error)}`);
    }
  }
}
