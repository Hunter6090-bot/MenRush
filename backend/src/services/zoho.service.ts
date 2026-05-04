import { URLSearchParams } from 'url';

const ZOHO_ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || 'accounts.zoho.com';
const ZOHO_CAMPAIGNS_DOMAIN = process.env.ZOHO_CAMPAIGNS_DOMAIN || 'campaigns.zoho.com';

const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const LIST_KEY = process.env.ZOHO_LIST_KEY;

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

const isConfigured = (): boolean =>
  Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && LIST_KEY);

const refreshAccessToken = async (): Promise<string> => {
  const params = new URLSearchParams({
    refresh_token: REFRESH_TOKEN as string,
    client_id: CLIENT_ID as string,
    client_secret: CLIENT_SECRET as string,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`https://${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    const message = body.error || body.error_description || `HTTP ${response.status}`;
    throw new Error(`Zoho OAuth refresh failed: ${message}`);
  }

  const ttlSeconds: number = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  cachedToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + (ttlSeconds - 60) * 1000,
  };
  return cachedToken.accessToken;
};

const getAccessToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }
  return refreshAccessToken();
};

const callListSubscribe = async (accessToken: string, email: string) => {
  const params = new URLSearchParams({
    resfmt: 'JSON',
    listkey: LIST_KEY as string,
    contactinfo: JSON.stringify({ 'Contact Email': email }),
  });

  const response = await fetch(
    `https://${ZOHO_CAMPAIGNS_DOMAIN}/api/v1.1/json/listsubscribe?${params.toString()}`,
    {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    }
  );

  const body = (await response.json().catch(() => ({}))) as ZohoListSubscribeBody;
  return { status: response.status, body };
};

type ZohoListSubscribeBody = {
  status?: string;
  code?: string;
  message?: string;
  Message?: string;
  [key: string]: unknown;
};

export const zohoCampaignsService = {
  isConfigured,

  async subscribeToWaitlist(email: string): Promise<void> {
    if (!isConfigured()) {
      throw new Error('Zoho Campaigns is not configured');
    }

    let accessToken = await getAccessToken();
    let { status, body } = await callListSubscribe(accessToken, email);

    if (status === 401 || body?.code === '401' || body?.status === 'unauthorized') {
      cachedToken = null;
      accessToken = await refreshAccessToken();
      ({ status, body } = await callListSubscribe(accessToken, email));
    }

    if (status >= 400) {
      throw new Error(`Zoho Campaigns error: HTTP ${status} ${JSON.stringify(body)}`);
    }

    const apiStatus: string | undefined = body?.status;
    if (apiStatus && apiStatus !== 'success') {
      const message = body?.message || body?.Message || JSON.stringify(body);
      throw new Error(`Zoho Campaigns error: ${message}`);
    }
  },
};
