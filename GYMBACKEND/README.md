# IronCore API

NestJS + MongoDB (Atlas) behind the IronCore gym app. Gyms, memberships,
payments, settlements and the door.

## Running it

```bash
npm install
cp .env.example .env      # then fill in MONGODB_URI
npm run seed              # optional: one worked-through demo gym
npm run dev               # http://localhost:4000, docs at /docs
```

`.env` is git-ignored. The only value that must be filled in by hand is
`MONGODB_URI`; the JWT secrets in your local `.env` were generated already.

## How money moves

1. The browser calls `POST /payments/initialize` saying *what* is being bought —
   never *what it costs*. The API prices it from the database, computes the
   split, and writes a `pending` row in the ledger.
2. The gateway confirms. In the sandbox that is `POST /payments/:ref/simulate`;
   with Paystack it is the signed webhook, with `GET /payments/:ref` as a
   fallback poll.
3. Only then does the purchase take effect — cover extended, pass issued, gym
   listed. That step is idempotent, so a retried webhook changes nothing.
4. A sweep moves confirmed payments from **pending settlement** to **settled to
   the gym's bank** a day later. Neither state is a balance IronCore holds.

`PLATFORM_FEE_RATE` (default 5%) is the only place the fee is defined.

### Swapping in real Paystack

```env
PAYMENTS_PROVIDER=paystack
PAYSTACK_SECRET_KEY=sk_test_...
```

Nothing else changes: both adapters implement the same port. Webhooks need a
public URL, so on localhost run a tunnel and point Paystack at
`https://<tunnel>/payments/webhook/paystack`.

## What the owner can see

Owner endpoints return the gym's **own share** only. `platformFee` and the gross
amount are absent from the aggregations that build those responses, so the fee
cannot be read off the network tab either. A member's own receipts do show the
split — it is their money.

## Security notes

- Argon2id passwords; account lockout after 5 failures.
- Access token (15 min) and refresh token (7 days) in httpOnly cookies. Refresh
  tokens are stored as SHA-256 hashes and rotated; replaying a used one revokes
  the whole family.
- Double-submit CSRF on every state-changing request.
- Global validation with `forbidNonWhitelisted`, helmet, per-route rate limits.
- Webhook signatures are verified over the raw request body.
- Staff routes check the gym on the token against the gym in the path, so one
  gym can never read another's data.

## Layout

```
src/
  auth/          sign-in, registration, token rotation
  users/         the accounts collection
  gyms/          gyms, listing plans, settlement accounts, bank lookups
  plans/         each gym's membership plans
  subscriptions/ member cover, roster, expiring soon
  payments/      initialize / verify / webhook + provider adapters
  transactions/  the ledger and the owner's read models
  settlements/   payout batches and the sweep
  daypasses/     guest passes
  checkins/      the door rule
  staff/         owner-managed logins
```

## Demo logins after `npm run seed`

| Who     | Phone         | Password     |
| ------- | ------------- | ------------ |
| Owner   | 0801 000 1111 | ironcore123  |
| Manager | 0802 000 2222 | ironcore123  |
| Scanner | 0803 000 3333 | ironcore123  |
| Member  | 0803 214 7765 | ironcore123  |
