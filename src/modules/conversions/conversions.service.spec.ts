import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ConversionsService } from './conversions.service';
import { parseGaCookie, requestContextMiddleware } from './request-context';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ConversionsService', () => {
  const fetchMock = jest.fn();

  const serviceWith = (config: Record<string, string | undefined>) =>
    new ConversionsService({
      get: (key: string) => config[key],
    } as unknown as ConfigService);

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const callTo = (host: string) =>
    fetchMock.mock.calls.find(([url]) => String(url).includes(host));

  it('sends nothing when no target is configured', async () => {
    serviceWith({}).track('sign_up', { userId: 'u1' });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a Discord embed and a GA4 Measurement Protocol event', async () => {
    serviceWith({
      'conversions.discordWebhookUrl': 'https://discord.test/webhook',
      'conversions.gaMeasurementId': 'G-TEST',
      'conversions.gaApiSecret': 'secret',
    }).track('purchase', {
      userId: 'u1',
      params: {
        value: 50,
        currency: 'EUR',
        transaction_id: 'p1',
        note: undefined,
      },
      summary: '50 EUR paid',
    });
    await flush();

    const [, discordInit] = callTo('discord.test')!;
    const discord = JSON.parse(discordInit.body);
    expect(discord.embeds[0]).toMatchObject({
      title: '💶 Payment completed',
      description: '50 EUR paid',
    });
    expect(
      discord.embeds[0].fields.map((f: { name: string }) => f.name),
    ).toEqual(['value', 'currency', 'transaction_id']);

    const [gaUrl, gaInit] = callTo('google-analytics.com')!;
    expect(gaUrl).toContain('measurement_id=G-TEST');
    expect(gaUrl).toContain('api_secret=secret');
    const ga = JSON.parse(gaInit.body);
    expect(ga.user_id).toBe('u1');
    expect(ga.client_id).toMatch(/^\d+\.\d+$/);
    expect(ga.events[0]).toMatchObject({
      name: 'purchase',
      params: { value: 50, currency: 'EUR', transaction_id: 'p1' },
    });
    expect(ga.events[0].params).not.toHaveProperty('note');
    // The Discord-only summary never reaches GA.
    expect(gaInit.body).not.toContain('50 EUR paid');
  });

  it("uses the browser's GA client id from the request, unless told not to", async () => {
    const service = serviceWith({
      'conversions.gaMeasurementId': 'G-TEST',
      'conversions.gaApiSecret': 'secret',
    });
    const req = {
      headers: { cookie: 'foo=1; _ga=GA1.1.111.222' },
    } as unknown as Request;

    requestContextMiddleware(req, {} as Response, () => {
      service.track('sign_up', { userId: 'u1' });
      service.track('registration_approved', {
        userId: 'u2',
        attributeToRequest: false,
      });
    });
    await flush();

    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(init.body),
    );
    expect(bodies[0].client_id).toBe('111.222');
    expect(bodies[1].client_id).not.toBe('111.222');
  });

  it('never throws when a target fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    expect(() =>
      serviceWith({
        'conversions.discordWebhookUrl': 'https://discord.test/webhook',
      }).track('sign_up'),
    ).not.toThrow();
    await flush();
  });
});

describe('parseGaCookie', () => {
  it('extracts the client id from a _ga cookie', () => {
    expect(parseGaCookie('GA1.1.123456789.1700000000')).toBe(
      '123456789.1700000000',
    );
    expect(parseGaCookie('garbage')).toBeUndefined();
    expect(parseGaCookie(undefined)).toBeUndefined();
  });
});
