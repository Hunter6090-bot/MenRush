import { Router } from 'express';
import { receiveVerotelPostback } from '../services/verotel.service';
import { VerotelError } from '../services/verotel-contract';

const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
// FlexPay v4 postbacks are signed GETs, not JSON/form POSTs. Never trust a user ID in a callback.
router.get('/', async (req, res) => {
  if (req.method !== 'GET') return res.set('Allow', 'GET').status(405).type('text/plain').send('ERROR');
  try {
    await receiveVerotelPostback(req.originalUrl.split('?')[1] || '');
    return res.status(200).type('text/plain').send('OK');
  } catch (error) {
    // Do not log signed query strings, card/buyer details, secrets, or raw database errors.
    const known = error instanceof VerotelError;
    console.error('[premium] postback rejected:', known ? error.code : 'transaction_failed');
    return res.status(known ? error.status : 503).type('text/plain').send('ERROR');
  }
});
router.all('/', (_req, res) => res.set('Allow', 'GET').status(405).type('text/plain').send('ERROR'));
export default router;
