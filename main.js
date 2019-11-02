let context, worker;
const FREQUENCIES = [
    [261.6, 329.6, 392.0, 440.0],
    [261.6, 329.6, 392.0, 440.0],
    [261.6, 329.6, 392.0, 440.0],
    [261.6, 329.6, 392.0, 440.0]
]

const state = {
    playing: false,
    grid: [
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
    ],
    bar: 0
}

const view = state => state.grid.map((row, rowIndex) => {
    return row.map((col, colIndex) => {
        const address = `${rowIndex}|${colIndex}|${FREQUENCIES[rowIndex][colIndex]}`
        const bg = !col ? "bg-yellow" : "bg-red"
        const br = colIndex === state.bar && state.playing ? "b--green" : "b--transparent"
        return `<div class="w4 h4 ma1 ba bw2 ${bg} ${br}" onclick="app.run('toggle', '${address}')"></div>`
    }).join("")
}).join("")

const playNotes = notes => {
    notes.filter(n => n).map(freq => {
        const o = context.createOscillator()
        o.frequency.value = Number(freq)
        o.connect(context.destination)
        o.start()
        o.stop(context.currentTime + .25)
    })
}

const update = {
    play: state => {
        if (!context) { context = new AudioContext() }
        worker = new Worker('worker.js')
        worker.onmessage = msg => app.run('tick', msg)
        worker.postMessage('start')
        return Object.assign({}, state, {playing: true})
    },
    stop: state => {
        worker.postMessage('stop')
        worker.terminate()
        worker = undefined
        return Object.assign({}, state, {playing: false, bar: 0})
    },
    toggle: (state, address) => {
        const [row, col, val] = address.split("|")
        const newGrid = [...state.grid]
        const newVal = !newGrid[row][col] ? val : null
        newGrid[row][col] = newVal
        return Object.assign({}, state, {grid: newGrid})
    },
    tick: (state) => {
        const bar = state.bar === 3 ? 0 : state.bar + 1
        playNotes(state.grid[bar])
        return Object.assign({}, state, {bar})
    },
    reset: (state) => {
        worker.postMessage('stop')
        worker.terminate()
        worker = undefined
        return {
            playing: false,
            grid: [
                [null, null, null, null],
                [null, null, null, null],
                [null, null, null, null],
                [null, null, null, null]
            ],
            bar: 0
        } 
    }
}

app.start("audio-grid", state, view, update)
