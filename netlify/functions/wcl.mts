import type { Config } from '@netlify/functions';
import { handleWclRequest } from '../../server/wclProxy';

export default async (req: Request): Promise<Response> =>
  handleWclRequest(req.method, await req.text(), {
    WCL_CLIENT_ID: Netlify.env.get('WCL_CLIENT_ID'),
    WCL_CLIENT_SECRET: Netlify.env.get('WCL_CLIENT_SECRET'),
  });

export const config: Config = { path: '/api/wcl' };
