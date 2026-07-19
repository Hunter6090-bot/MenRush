# Resend DNS fix — menrush.com

As of 2026-06-01, Resend can see `menrush.com` but the domain status is `failed`.

DNS is hosted at Namecheap/registrar-servers:

- `dns1.registrar-servers.com`
- `dns2.registrar-servers.com`

Vercel is not hosting the DNS records, so these records must be edited at the DNS provider.

## Records Resend currently requires

Add or correct these records in Advanced DNS:

| Type | Host | Value | Priority | TTL |
| --- | --- | --- | --- | --- |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDbvScCizQxlNeeD4RHld/GQpcNyi72BAnMnoYeMlKLEoJIvpkaz/vSp/YAnhQQSthZdtGSd9VqUVqu3ySkS9380VfBj8WW55TeR9V+I/wTED+6V2qwMcCXiTOc7q7b3TYPoeFcrTzN7m3+oUCMx4oj0f3SbZkwyFWvbXufI6lPOwIDAQAB` | - | Automatic |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | `10` | Automatic |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | - | Automatic |

## Existing mismatch found

`send.menrush.com` currently has this MX record:

```text
10 inbound-smtp.eu-west-1.amazonaws.com.
```

That does not match Resend's required value. Replace it with the `feedback-smtp.us-east-1.amazonses.com` MX record above.

## Already present

Root DMARC exists:

```text
v=DMARC1; p=none; rua=mailto:al@menrush.com; ruf=mailto:al@menrush.com; sp=none; adkim=r; aspf=r; pct=100
```

After DNS changes propagate, rerun the Resend domain check before sending the Beta 200 email.
