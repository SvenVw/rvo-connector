import { RvoClient } from '../src/client';
import * as readline from 'readline';
import 'dotenv/config';

async function main() {
  // Configuration from environment variables
  const clientId = process.env.CLIENT_ID;
  const username = process.env.ABA_USERNAME;
  const password = process.env.ABA_PASSWORD;
  const env = (process.env.NODE_ENV === 'production' ? 'production' : 'acceptance') as 'acceptance' | 'production';

  if (!clientId || !username || !password) {
    console.error('Error: Missing required environment variables (CLIENT_ID, ABA_USERNAME, ABA_PASSWORD).');
    console.error('Please check your .env file.');
    process.exit(1);
  }

  console.log('--- RVO ABA Connection Example (Bedrijfspercelen) ---');
  console.log(`Environment: ${env}`);

  const client = new RvoClient({
    environment: env,
    authMode: 'ABA',
    clientId: clientId,
    aba: {
      username: username,
      password: password,
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    '\nPlease enter the Farm ID (KvK-nummer) to query crop fields (optional, press Enter for test farm): ',
    async (farmId) => {
      console.log('\nFetching Bedrijfspercelen...');
      try {
        const result = await client.opvragenBedrijfspercelen({
          farmId: farmId.trim() || undefined,
        });
        console.log('\nSuccessfully fetched Bedrijfspercelen:');
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('\nFailed to fetch Bedrijfspercelen:', error);
      } finally {
        rl.close();
      }
    }
  );
}

main();
