import { mkdir, rename, statfs, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
	options: {
		drive: { type: 'string', multiple: true, default: [] },
		output: { type: 'string' },
	},
})
const snapshot = values.output ? resolve(values.output) : fileURLToPath(new URL('../inventory/inventory.json', import.meta.url))
const drivePaths = new Map([['Host drive', homedir()]])
for (const entry of values.drive) {
	const separator = entry.indexOf('=')
	if (separator < 1 || separator === entry.length - 1) throw new Error('Use --drive "Drive name=/path/to/drive".')
	const name = entry.slice(0, separator).trim()
	if (!name || name === 'Docker data') throw new Error('Each drive needs a name other than Docker data.')
	drivePaths.set(name, resolve(entry.slice(separator + 1)))
}

async function drives() {
	return Promise.all([...drivePaths].map(async ([name, path]) => {
		try {
			const fs = await statfs(path)
			return {
				name,
				total: fs.blocks * fs.bsize,
				used: (fs.blocks - fs.bfree) * fs.bsize,
				available: fs.bavail * fs.bsize,
			}
		} catch {
			return { name }
		}
	}))
}

await mkdir(dirname(snapshot), { recursive: true })
console.log('Publishing drive capacities.')

for (;;) {
	try {
		const readings = await drives()
		const document = { sampledAt: Date.now(), drives: readings }
		await writeFile(snapshot + '.tmp', JSON.stringify(document), { mode: 0o644 })
		await rename(snapshot + '.tmp', snapshot)
	} catch (error) {
		console.error(error.message)
	}
	await setTimeout(5000)
}
