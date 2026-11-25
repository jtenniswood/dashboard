import { execFile } from 'node:child_process'
import { mkdir, rename, statfs, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs, promisify } from 'node:util'

const exec = promisify(execFile)
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

async function runningContainers() {
	const format = '{{json .Names}}\t{{json .Ports}}\t{{json (.Label "dashboard.exclude")}}'
	const { stdout } = await exec('docker', ['container', 'ls', '--filter', 'status=running', '--format', format], {
		timeout: 4500,
		maxBuffer: 1024 * 1024,
	})
	return stdout.trim().split('\n').filter(Boolean).map(line => line.split('\t').map(field => JSON.parse(field)))
		.filter(([name, , excluded]) => name && excluded !== 'true')
		.map(([name, published]) => ({
			name,
			ports: [...new Set([...published.matchAll(/:(\d+)->\d+\/tcp/g)].map(match => Number(match[1])))],
		}))
		.sort((a, b) => a.name.localeCompare(b.name))
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
console.log('Publishing running Docker containers and drive capacities.')

let previousError = ''
for (;;) {
	try {
		const [containers, storage] = await Promise.allSettled([runningContainers(), drives()])
		const errors = [containers, storage].filter(result => result.status === 'rejected').map(result => result.reason.message).join('\n')
		if (errors && errors !== previousError) console.error(errors)
		const document = {
			sampledAt: Date.now(),
			containers: containers.status === 'fulfilled' ? containers.value : null,
			drives: storage.status === 'fulfilled' ? storage.value : null,
		}
		await writeFile(snapshot + '.tmp', JSON.stringify(document), { mode: 0o644 })
		await rename(snapshot + '.tmp', snapshot)
		previousError = errors
	} catch (error) {
		console.error(error.message)
	}
	await setTimeout(5000)
}
