import './lib/setup';
import { CustomClient } from './lib/client';

const main = async () => {
	const client = new CustomClient();
	try {
		client.logger.info('Logging in');
		await client.login();
		client.logger.info('logged in');
	} catch (error) {
		client.logger.fatal(error);
		await client.destroy();
		process.exit(1);
	}
};

void main();
