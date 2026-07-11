import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import type { StoreRegistryValue } from '@sapphire/pieces';
import { blue, gray, green, magenta, magentaBright, white, yellow } from 'colorette';
import { ActivityType } from 'discord.js';
import { totalmem } from 'os';
import { AutoCloseService } from '@/services/autoClose';

const dev = process.env.NODE_ENV !== 'production';

@ApplyOptions<Listener.Options>({ once: true, name: 'clientReady' })
export class ReadyEvent extends Listener {
	private readonly style = dev ? yellow : blue;

	public override run() {
		this.printBanner();
		this.printStoreDebugInformation();
		this.updateStatus();
		AutoCloseService.start();
	}

	private printBanner() {
		const success = green('+');

		const llc = dev ? magentaBright : white;
		const blc = dev ? magenta : blue;

		const line01 = llc('');
		const line02 = llc('');
		const line03 = llc('');

		// Offset Pad
		const pad = ' '.repeat(7);

		console.log(
			String.raw`
			${line01} ${pad}${blc('1.0.0')}
			${line02} ${pad}[${success}] Gateway
			${line03}${dev ? ` ${pad}${blc('<')}${llc('/')}${blc('>')} ${llc('DEVELOPMENT MODE')}` : ''}
		`.trim()
		);
	}

	private printStoreDebugInformation() {
		const { client, logger } = this.container;
		const stores = [...client.stores.values()];
		const last = stores.pop()!;

		for (const store of stores) logger.info(this.styleStore(store, false));
		logger.info(this.styleStore(last, true));
	}

	private styleStore(store: StoreRegistryValue, last: boolean) {
		return gray(`${last ? '└─' : '├─'} Loaded ${this.style(store.size.toString().padEnd(3, ' '))} ${store.name}.`);
	}

	private updateStatus() {
		if (process.env.NODE_ENV === 'production') {
			this.container.client.user?.setActivity('for tickets', { type: ActivityType.Watching });
			return;
		}

		setInterval(() => this.memoryUsage(), 1000);
	}

	private memoryUsage() {
		try {
			const memUsage = process.memoryUsage();
			const systemTotalRam = totalmem();

			// Format memory values
			const formatBytes = (bytes: number) => {
				const sizes = ['B', 'KB', 'MB', 'GB'];
				if (bytes === 0) return '0 B';
				const i = Math.floor(Math.log(bytes) / Math.log(1024));
				return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
			};

			// Calculate RAM usage percentage
			const processTotalMemory = memUsage.rss;
			const ramUsagePercent = ((processTotalMemory / systemTotalRam) * 100).toFixed(3);

			// Format the activity text
			const ramUsage = formatBytes(processTotalMemory);
			const activityText = `${ramUsage} RAM (${ramUsagePercent}% of system)`;

			// Set the bot's activity
			if (this.container.client.user) {
				this.container.client.user.setActivity({
					name: activityText,
					type: ActivityType.Streaming
				});
			}
		} catch (error) {
			this.container.logger.error('Failed to update status:', error);
		}
	}
}
