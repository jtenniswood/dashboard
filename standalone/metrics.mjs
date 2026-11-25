import { readFileSync, statfsSync } from 'node:fs'
import { cpus, freemem, totalmem } from 'node:os'

function cpuTimes() {
	const processors = cpus()
	const totals = { idle: 0, time: 0, cores: processors.length }
	for (const { times } of processors) {
		totals.idle += times.idle
		totals.time += Object.values(times).reduce((sum, time) => sum + time, 0)
	}
	return totals
}

function networkBytes() {
	try {
		const interfaces = readFileSync('/proc/net/dev', 'utf8').trim().split('\n').slice(2)
		return interfaces.reduce(({ rx, tx }, line) => {
			const [name, values] = line.split(':')
			if (name.trim() === 'lo') return { rx, tx }
			const counters = values.trim().split(/\s+/).map(Number)
			return { rx: rx + counters[0], tx: tx + counters[8] }
		}, { rx: 0, tx: 0 })
	} catch {
		return null
	}
}

export function sampleMetrics(dataDir) {
	let cpu = cpuTimes()
	let network = networkBytes()
	let sampledAt = performance.now()
	let latest

	function update() {
		const current = cpuTimes()
		const time = current.time - cpu.time
		const cpuPercent = time > 0 ? Math.round(100 * (1 - (current.idle - cpu.idle) / time)) : 0
		cpu = current

		const currentNetwork = networkBytes()
		const now = performance.now()
		const elapsed = (now - sampledAt) / 1000
		const rate = key => currentNetwork && network && elapsed >= 1
			? Math.max(0, Math.round((currentNetwork[key] - network[key]) / elapsed))
			: 0
		const disk = statfsSync(dataDir)
		const ramTotal = totalmem()
		latest = {
			cpuPercent,
			cpuCores: current.cores,
			ramTotal,
			ramPercent: Math.round(100 * (1 - freemem() / ramTotal)),
			diskTotal: disk.blocks * disk.bsize,
			diskUsed: (disk.blocks - disk.bfree) * disk.bsize,
			diskAvailable: disk.bavail * disk.bsize,
			network: currentNetwork ? { down: rate('rx'), up: rate('tx') } : null,
		}
		network = currentNetwork
		sampledAt = now
	}

	update()
	setInterval(update, 2000).unref()
	return () => latest
}
